import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

/**
 * Generates a single surprising / real-world insight from a topic for the
 * Daily Scroll of Wisdom. Returns plain text — 2-3 sentences max.
 */
export async function generateScrollInsight(params: {
  topicTitle: string;
  summary: string;
  keyConcepts: string[];
  courseTitle: string;
}): Promise<string> {
  const { topicTitle, summary, keyConcepts, courseTitle } = params;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
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
- Write in the same language as the topic/summary (Hebrew or English).
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
