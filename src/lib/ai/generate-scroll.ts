import Anthropic from "@anthropic-ai/sdk";
import { COACH_PERSONA_SYSTEM } from "@/lib/ai/coach-persona";

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

export type OutputLanguage = "auto" | "en" | "he";

function languageInstruction(lang: OutputLanguage): string {
  if (lang === "en") return "Write in ENGLISH regardless of the topic/summary language.";
  if (lang === "he") return "Write in HEBREW regardless of the topic/summary language.";
  return "Write in the same language as the topic/summary (Hebrew or English).";
}

/**
 * Generates a single surprising / real-world insight from a topic for the
 * Daily Scroll of Wisdom. Returns plain text — 2-3 sentences max.
 */
export async function generateScrollInsight(params: {
  topicTitle: string;
  summary: string;
  keyConcepts: string[];
  courseTitle: string;
  outputLanguage?: OutputLanguage;
}): Promise<string> {
  const { topicTitle, summary, keyConcepts, courseTitle } = params;
  const outputLanguage = params.outputLanguage ?? "auto";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    // Loremaster persona — the daily Scroll is the Loremaster's voice
    // most directly. The persona's "Daily wisdom (Scroll)" rule applies.
    system: COACH_PERSONA_SYSTEM,
    messages: [
      {
        role: "user",
        content: `You are a passionate professor who loves revealing the surprising, counterintuitive, or real-world side of academic topics.

Course: ${courseTitle}
Topic: ${topicTitle}
Summary: ${summary}
Key concepts: ${keyConcepts.slice(0, 6).join(", ")}

Write ONE single fascinating insight about this topic — something surprising, counterintuitive, or a real-world connection that makes a student think "I never thought about it that way."

Rules:
- Exactly 2-3 sentences. No more.
- Must feel like a genuine revelation, not a summary.
- ${languageInstruction(outputLanguage)}
- Do NOT use bullet points, headers, or markdown — plain prose only.
- Do NOT start with "Did you know" — be more creative.

Return ONLY the insight text, nothing else.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  // Strip any accidental markdown wrapping
  return content.text
    .trim()
    .replace(/^```[\s\S]*?```$/gm, "")
    .replace(/^\*\*[\s\S]*?\*\*$/gm, "")
    .trim();
}
