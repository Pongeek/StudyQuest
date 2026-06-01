// Multi-turn clarifier endpoint. Single endpoint serves all answer kinds
// (quiz / review / boss / exam) so Phase 2 expansion adds no new routes —
// but the pilot only accepts answerKind="quiz".
//
// Body shapes:
//   { answerKind, answerId }                  → open session (returns opener)
//   { answerKind, answerId, message }         → continue (returns reply)

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

  // Pilot scope: only quiz wired up. Review/Boss/Exam return a clean
  // classified error so future client code can detect and gate.
  if (answerKind !== "quiz") {
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

  // ── Fetch the answer + ownership chain ─────────────────────────────────
  // quiz_answers → quiz_sessions(user_id). The combined inner join gives
  // us the answer + session user_id in one round-trip; we then assert it
  // matches dbUser.id before doing anything else.
  const { data: answerRow } = await supabase
    .from("quiz_answers")
    .select(
      `
      id,
      user_answer,
      ai_score,
      ai_feedback,
      image_url,
      confidence,
      question_id,
      session_id,
      quiz_sessions!inner ( user_id, topic_id )
    `,
    )
    .eq("id", answerId)
    .single();

  if (!answerRow) {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "That answer no longer exists. Refresh the page.", false),
      { status: 404 },
    );
  }

  // Supabase types nested-join as an object OR array depending on relation
  // metadata; defensively unwrap.
  const session = Array.isArray(answerRow.quiz_sessions)
    ? answerRow.quiz_sessions[0]
    : answerRow.quiz_sessions;
  if (!session || session.user_id !== dbUser.id) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "You don't have access to that trial.", false),
      { status: 403 },
    );
  }

  // ── Fetch question. INTENTIONALLY does NOT filter replaced_at IS NULL —
  // the clarifier MUST work against the question the student originally
  // saw, even if it was soft-replaced later via Regenerate.
  const { data: question } = await supabase
    .from("questions")
    .select("content, correct_answer, explanation, topic_id")
    .eq("id", answerRow.question_id)
    .single();

  if (!question) {
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Couldn't find the underlying question — refresh.", false),
      { status: 404 },
    );
  }

  // ── Fetch topic title ─────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from("topics")
    .select("title")
    .eq("id", question.topic_id)
    .single();

  // ── Existing clarification row (if any) ───────────────────────────────
  // Use ordered .limit(1) + array access rather than .maybeSingle() so the
  // query tolerates duplicate rows. Duplicates can appear in dev because
  // React 19 + Next.js dev-mode StrictMode double-fires the useEffect that
  // opens the clarifier — both opens race past the existing-check before
  // either has committed, both INSERT, and we end up with 2 rows for the
  // same (answer_kind, answer_id). .maybeSingle() errors on >1 rows and
  // would make every continue call 404. .order().limit(1) always returns
  // 0 or 1 — pick the oldest so we stay consistent with whatever the UI
  // saw first. Production doesn't have StrictMode double-fire, but
  // simultaneous tabs could still race; the same defensive pattern handles
  // both. (Phase 2 follow-up: add UNIQUE(answer_kind, answer_id) +
  // upsert with onConflict to eliminate the duplicate insert at the
  // schema level.)
  const { data: existingRows } = await supabase
    .from("answer_clarifications")
    .select("id, messages, total_output_tokens, total_turns")
    .eq("answer_kind", "quiz")
    .eq("answer_id", answerId)
    .order("created_at", { ascending: true })
    .limit(1);
  const existing =
    existingRows && existingRows.length > 0 ? existingRows[0] : null;

  // ── Resolve confidence + image for the AI context ─────────────────────
  // Pilot scope: image-only answers are supported in grading but the
  // clarifier passes studentImage: null. If Max's manual test (Task 10)
  // reveals the model can't clarify image-only answers well, the follow-up
  // is to hydrate image bytes from quiz_answers.image_url via Supabase
  // Storage. Not added preemptively (YAGNI).
  const ctx = {
    question: question.content,
    studentAnswer: answerRow.user_answer || "",
    studentImage: null,
    canonicalAnswer: question.correct_answer || "",
    score: Number(answerRow.ai_score) || 0,
    topicTitle: topic?.title || "",
    sourceExcerpt: null,
    confidence: (answerRow.confidence as ConfidenceValue) || null,
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

      const { data: created, error: insertErr } = await supabase
        .from("answer_clarifications")
        .insert({
          user_id: dbUser.id,
          answer_kind: "quiz",
          answer_id: answerId,
          messages: [opener],
          total_turns: 1,
          total_output_tokens: reply.outputTokens,
        })
        .select("id, messages")
        .single();

      if (insertErr || !created) {
        console.error("[api/clarify] insert failed:", insertErr);
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
    // Detected at the answer level: score >= 0.7 AND confidence === "guessed"
    // (same condition used by buildSystemPrompt in clarify-answer.ts to pick
    // the lucky-guess prompt). The lucky-guess UI never sends CONTINUE; this
    // guard defends against any future client and is a no-op for the normal
    // wrong-answer flow.
    const isLuckyGuess =
      Number(answerRow.ai_score) >= 0.7 && answerRow.confidence === "guessed";
    if (isLuckyGuess) {
      return NextResponse.json(
        classifiedErrorBody(
          "UNKNOWN",
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
