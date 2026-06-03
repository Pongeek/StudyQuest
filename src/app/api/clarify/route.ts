// Multi-turn clarifier endpoint. Single endpoint serves all answer kinds
// (quiz / review / boss / exam) so Phase 2 expansion adds no new routes.
// Quiz + Review are live; boss / exam still return "coming soon".
//
// Body shapes:
//   { answerKind, answerId }                  → open session (returns opener)
//   { answerKind, answerId, message }         → continue (returns reply)
//
// All answer-table specifics are funneled through resolveAnswerContext(),
// which returns a normalized, kind-agnostic shape. Every downstream branch
// (question/topic fetch, transcript read/write, budget cap, lucky-guess
// single-shot guard) consumes that shape and never touches a kind-specific
// column again.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { classifyAiError, classifiedErrorBody } from "@/lib/ai-error";
import {
  openClarifier,
  continueClarifier,
  type ClarifierMessage,
  type ConfidenceValue,
} from "@/lib/ai/clarify-answer";

export const maxDuration = 60;

// Total output-token cap per clarifier session. Server-side guard so a
// runaway thread (user keeps sending follow-ups) can't blow Max's
// Anthropic budget. ~6000 tokens ≈ ~$0.03 / session ceiling.
const SESSION_OUTPUT_TOKEN_CAP = 6000;

type AnswerKind = "quiz" | "review" | "boss" | "exam";

type SupabaseClient = ReturnType<typeof createServiceClient>;

/**
 * Normalized answer context — kind-agnostic. Resolved once per request from
 * the answer-kind-specific table + ownership chain. ALL downstream logic
 * consumes this shape and never re-touches a kind-specific column.
 */
interface AnswerContext {
  userAnswer: string;
  score: number;
  confidence: ConfidenceValue | null;
  questionId: string;
  topicId: string;
  ownerUserId: string;
}

/**
 * Resolve + ownership-check an answer row, keyed on answerKind. Each live kind
 * maps its own table + session ownership chain into the normalized shape.
 *
 * - quiz  : quiz_answers   → quiz_sessions(user_id)
 * - review: review_answers → review_sessions(user_id)
 *
 * Returns null when the row doesn't exist OR the nested session can't be
 * unwrapped (caller turns null into a 404). Ownership equality against the
 * requesting dbUser is asserted by the caller via ctx.ownerUserId.
 */
async function resolveAnswerContext(
  supabase: SupabaseClient,
  answerKind: AnswerKind,
  answerId: string,
): Promise<AnswerContext | null> {
  if (answerKind === "quiz") {
    const { data: row } = await supabase
      .from("quiz_answers")
      .select(
        `
        user_answer,
        ai_score,
        confidence,
        question_id,
        quiz_sessions!inner ( user_id, topic_id )
      `,
      )
      .eq("id", answerId)
      .single();
    if (!row) return null;
    const session = Array.isArray(row.quiz_sessions)
      ? row.quiz_sessions[0]
      : row.quiz_sessions;
    if (!session) return null;
    return {
      userAnswer: row.user_answer || "",
      score: Number(row.ai_score) || 0,
      confidence: (row.confidence as ConfidenceValue) || null,
      questionId: row.question_id,
      topicId: session.topic_id,
      ownerUserId: session.user_id,
    };
  }

  if (answerKind === "review") {
    // review_answers carries its own topic_id (review sessions interleave
    // topics), so we read it off the answer row, not the session.
    const { data: row } = await supabase
      .from("review_answers")
      .select(
        `
        user_answer,
        ai_score,
        confidence,
        question_id,
        topic_id,
        review_sessions!inner ( user_id )
      `,
      )
      .eq("id", answerId)
      .single();
    if (!row) return null;
    const session = Array.isArray(row.review_sessions)
      ? row.review_sessions[0]
      : row.review_sessions;
    if (!session) return null;
    return {
      userAnswer: row.user_answer || "",
      score: Number(row.ai_score) || 0,
      confidence: (row.confidence as ConfidenceValue) || null,
      questionId: row.question_id,
      topicId: row.topic_id,
      ownerUserId: session.user_id,
    };
  }

  // boss / exam not wired yet — unreachable (gated earlier), but exhaustive.
  return null;
}

export async function POST(request: NextRequest) {
  let body: { answerKind?: AnswerKind; answerId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Malformed request — refresh and try again.", false),
      { status: 400 },
    );
  }

  const { answerKind, answerId, message } = body;
  if (!answerKind || !answerId) {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Missing answer reference. Refresh and try again.", false),
      { status: 400 },
    );
  }

  // Live scope: quiz + review. Boss/Exam return a clean classified error so
  // future client code can detect and gate.
  if (answerKind !== "quiz" && answerKind !== "review") {
    return NextResponse.json(
      classifiedErrorBody(
        "UNKNOWN",
        "The Loremaster isn't available for this trial type yet — coming soon.",
        false,
      ),
      { status: 409 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      classifiedErrorBody(
        "AUTH_ERROR",
        "Your sign-in expired. Refresh the page to sign back in.",
        false,
      ),
      { status: 401 },
    );
  }

  const supabase = createServiceClient();

  // ── Resolve dbUser.id from clerk_id ────────────────────────────────────
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();
  if (!dbUser) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "Couldn't resolve your account. Refresh and sign in.", false),
      { status: 401 },
    );
  }

  // ── Resolve the answer + ownership via the kind-keyed normalizer ───────
  const answerCtx = await resolveAnswerContext(supabase, answerKind, answerId);
  if (!answerCtx) {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "That answer no longer exists. Refresh the page.", false),
      { status: 404 },
    );
  }
  if (answerCtx.ownerUserId !== dbUser.id) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "You don't have access to that trial.", false),
      { status: 403 },
    );
  }

  // ── Fetch question. INTENTIONALLY does NOT filter replaced_at IS NULL —
  // the clarifier MUST work against the question the student originally
  // saw, even if it was soft-replaced later via Regenerate. We resolve via
  // the stored answer row's question_id, never a live lookup that could 404
  // on a retired question.
  const { data: question } = await supabase
    .from("questions")
    .select("content, correct_answer, explanation, topic_id")
    .eq("id", answerCtx.questionId)
    .single();

  if (!question) {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Couldn't find the underlying question — refresh.", false),
      { status: 404 },
    );
  }

  // ── Fetch topic title ─────────────────────────────────────────────────
  // Prefer the question's topic_id, falling back to the answer context's.
  const { data: topic } = await supabase
    .from("topics")
    .select("title")
    .eq("id", question.topic_id ?? answerCtx.topicId)
    .single();

  // ── Existing clarification row (if any) ───────────────────────────────
  // The migration-024 UNIQUE(answer_kind, answer_id) guarantees at most one
  // row per session now, so .maybeSingle() is safe (no more StrictMode
  // duplicate rows to tolerate).
  const { data: existing } = await supabase
    .from("answer_clarifications")
    .select("id, messages, total_output_tokens, total_turns")
    .eq("answer_kind", answerKind)
    .eq("answer_id", answerId)
    .maybeSingle();

  // ── Resolve confidence + image for the AI context ─────────────────────
  // Image-only answers are supported in grading but the clarifier passes
  // studentImage: null (parity with Quiz — YAGNI on Storage hydration; the
  // system prompt honestly tells Claude the diagram isn't available).
  const ctx = {
    question: question.content,
    studentAnswer: answerCtx.userAnswer,
    studentImage: null,
    canonicalAnswer: question.correct_answer || "",
    score: answerCtx.score,
    topicTitle: topic?.title || "",
    sourceExcerpt: null,
    confidence: answerCtx.confidence,
  };

  try {
    // ── Branch 1: OPEN session ───────────────────────────────────────────
    if (!message) {
      if (existing) {
        // Resume — return prior history; don't burn a Claude call.
        // Apply the same budget cap guard as CONTINUE so a capped
        // session reopens already-closed at mount time, instead of
        // letting the UI enable the textarea + Send and then yanking
        // the typed turn when CONTINUE hits the cap.
        if (existing.total_output_tokens >= SESSION_OUTPUT_TOKEN_CAP) {
          return NextResponse.json({
            clarificationId: existing.id,
            messages: existing.messages,
            closed: true,
            reason: "budget",
          });
        }
        return NextResponse.json({
          clarificationId: existing.id,
          messages: existing.messages,
        });
      }

      const reply = await openClarifier(ctx);
      const opener: ClarifierMessage = {
        role: "assistant",
        content: reply.content,
        stopReason: reply.stopReason,
        outputTokens: reply.outputTokens,
        createdAt: new Date().toISOString(),
      };

      // Upsert on the (answer_kind, answer_id) unique constraint. If a
      // concurrent open already inserted (e.g. StrictMode double-fire in
      // dev), the conflict resolves to that row instead of erroring or
      // creating a duplicate.
      const { data: created, error: insertErr } = await supabase
        .from("answer_clarifications")
        .upsert(
          {
            user_id: dbUser.id,
            answer_kind: answerKind,
            answer_id: answerId,
            messages: [opener],
            total_turns: 1,
            total_output_tokens: reply.outputTokens,
          },
          { onConflict: "answer_kind,answer_id", ignoreDuplicates: false },
        )
        .select("id, messages")
        .single();

      if (insertErr || !created) {
        console.error("[api/clarify] upsert failed:", insertErr);
        return NextResponse.json(
          classifiedErrorBody("UNKNOWN", "Couldn't open the clarifier — try again.", true),
          { status: 500 },
        );
      }

      return NextResponse.json({ clarificationId: created.id, messages: created.messages });
    }

    // ── Branch 2: CONTINUE session ───────────────────────────────────────
    if (!existing) {
      return NextResponse.json(
        classifiedErrorBody("UNKNOWN", "No active clarifier — start one first.", false),
        { status: 404 },
      );
    }

    // Hard budget guard: if we've already burned the cap, soft-close.
    if (existing.total_output_tokens >= SESSION_OUTPUT_TOKEN_CAP) {
      return NextResponse.json({
        clarificationId: existing.id,
        messages: existing.messages,
        closed: true,
        reason: "budget",
      });
    }

    // ── Lucky-guess answers are SINGLE-SHOT — no follow-up turns ──
    // Same condition `buildSystemPrompt` in clarify-answer.ts uses to pick
    // the lucky-guess prompt (`ctx.score >= 0.7 && ctx.confidence === "guessed"`).
    // The lucky-guess UI never sends CONTINUE; this guard defends against any
    // future client and is a no-op for the normal wrong-answer flow. Classified
    // as SESSION_CLOSED so the client envelope can distinguish "intentional
    // single-shot wall" from a generic UNKNOWN ("try again, your answer is saved")
    // — the latter would mislead the user into retrying something that can't
    // succeed.
    const isLuckyGuess = ctx.score >= 0.7 && answerCtx.confidence === "guessed";
    if (isLuckyGuess) {
      return NextResponse.json(
        classifiedErrorBody(
          "SESSION_CLOSED",
          "This explanation is single-shot — no follow-up available.",
          false,
        ),
        { status: 409 },
      );
    }

    const history = existing.messages as ClarifierMessage[];
    const reply = await continueClarifier(ctx, history, message);

    const userTurn: ClarifierMessage = {
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    const assistantTurn: ClarifierMessage = {
      role: "assistant",
      content: reply.content,
      stopReason: reply.stopReason,
      outputTokens: reply.outputTokens,
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...history, userTurn, assistantTurn];
    const newTurns = existing.total_turns + 1;
    const newOutputTokens = existing.total_output_tokens + reply.outputTokens;

    const { error: updateErr } = await supabase
      .from("answer_clarifications")
      .update({
        messages: newMessages,
        total_turns: newTurns,
        total_output_tokens: newOutputTokens,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateErr) {
      // The Claude reply was generated but never persisted. Returning
      // 200 here would let the client render the new turn and then
      // SILENTLY drop it on the next resume (the row in DB is still
      // the pre-update state) — and the tokens are gone with nothing
      // saved. Surface the failure instead so the client toasts +
      // keeps the draft.
      console.error("[api/clarify] update failed:", updateErr);
      return NextResponse.json(
        classifiedErrorBody(
          "UNKNOWN",
          "Couldn't save the Loremaster's reply — try again.",
          true,
        ),
        { status: 500 },
      );
    }

    return NextResponse.json({
      clarificationId: existing.id,
      messages: newMessages,
    });
  } catch (err) {
    console.error("[api/clarify] Claude failure:", err);
    const classified = classifyAiError(err);
    return NextResponse.json({ error: classified }, { status: 502 });
  }
}
