// "Why was I wrong?" clarifier — multi-turn Claude reply.
//
// The INVERSE of feynman-tutor.ts: that file is a Socratic peer who never
// answers; this one is a guide (Loremaster) who DOES answer, but
// progressively scaffolded from what the student says is unclear.
//
// Cost discipline (per spec §7.4):
//  - max_tokens 1024 per turn (vs 2048 in graders)
//  - Server-side hard guard at 6000 total output tokens / session (see /api/clarify)
//  - Logged per call: stop_reason, output_tokens, turn number

import Anthropic from "@anthropic-ai/sdk";
import { withCoachPersona } from "@/lib/ai/coach-persona";

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

export type ClarifierMessage = {
  role: "user" | "assistant";
  content: string;
  // Persisted on assistant turns for cost auditing
  stopReason?: string;
  outputTokens?: number;
  createdAt: string; // ISO
};

export type ConfidenceValue = "guessed" | "unsure" | "confident" | null;

export interface ClarifierContext {
  question: string;
  studentAnswer: string;          // empty when image-only
  studentImage?: {                 // optional Claude vision block input
    mediaType: "image/jpeg" | "image/png" | "image/webp";
    base64: string;
  } | null;
  canonicalAnswer: string;
  score: number;                   // 0..1
  topicTitle: string;
  sourceExcerpt?: string | null;
  confidence: ConfidenceValue;
}

export interface ClarifierReply {
  content: string;
  outputTokens: number;
  stopReason: string;
}

function buildSystemPrompt(ctx: ClarifierContext): string {
  const confidenceLine =
    ctx.confidence === "confident"
      ? "The student SAID they were CONFIDENT but got it wrong. Gently surface the gap — name what most students miss here. Do not shame."
      : ctx.confidence === "guessed"
        ? "The student SAID they were GUESSING. Meet them where they are. Build from primitives. No shaming, no minimizing."
        : "The student did not rate their confidence. Use a balanced default — assume mid-confidence.";

  const task = `You are clarifying a question the student got wrong (score ${ctx.score.toFixed(2)}/1.0).

YOUR JOB
- OPEN by asking what part is unclear. Do not jump straight into explaining — target the explanation to the actual confusion.
- After the student says what's unclear, give a SCAFFOLDED answer: one idea + one check question per turn.
- Three turns max under normal use. After three assistant turns, wrap up.
- You DO give answers. You are not Feynman. You are a guide who explains.
- Match the student's language. Hebrew in → Hebrew out.
- Code blocks stay LTR; prose follows the student's direction.
- Never invent facts beyond the topic source. If asked something outside scope, redirect: "That's outside this topic — but if you have the source page, I can look at it."

CONFIDENCE-AWARE TONE
${confidenceLine}

CONTEXT
Topic: ${ctx.topicTitle}
${ctx.sourceExcerpt ? `Source excerpt:\n${ctx.sourceExcerpt}\n` : ""}
Question the student got wrong:
${ctx.question}

Canonical correct answer (do NOT just paste this — scaffold to it):
${ctx.canonicalAnswer}

Student's answer:
${ctx.studentAnswer || "(image only — see attached)"}`;

  return withCoachPersona(task);
}

/**
 * First turn — opens the clarifier session. Student has not spoken yet.
 * Sends an empty "start" trigger (matches feynman-tutor.ts pattern).
 */
export async function openClarifier(ctx: ClarifierContext): Promise<ClarifierReply> {
  const userBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  if (ctx.studentImage) {
    userBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: ctx.studentImage.mediaType,
        data: ctx.studentImage.base64,
      },
    });
  }
  userBlocks.push({ type: "text", text: "start" });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: buildSystemPrompt(ctx),
    messages: [{ role: "user", content: userBlocks }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Clarifier opener returned no text block");
  }

  return {
    content: textBlock.text.trim(),
    outputTokens: response.usage.output_tokens,
    stopReason: response.stop_reason ?? "unknown",
  };
}

/**
 * Continue an existing clarifier — pass full history + the newest user message.
 * Each call rebuilds the system prompt (cheap; ~1024 tokens prepended).
 */
export async function continueClarifier(
  ctx: ClarifierContext,
  history: ClarifierMessage[],
  studentMessage: string,
): Promise<ClarifierReply> {
  const messages: Anthropic.Messages.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  messages.push({ role: "user", content: studentMessage });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: buildSystemPrompt(ctx),
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Clarifier continuation returned no text block");
  }

  return {
    content: textBlock.text.trim(),
    outputTokens: response.usage.output_tokens,
    stopReason: response.stop_reason ?? "unknown",
  };
}
