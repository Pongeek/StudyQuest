import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

export type ConversationMessage = { role: "user" | "assistant"; content: string };

/**
 * Returns Claude's next reply as a curious student.
 * This is the FIRST multi-turn call in the codebase.
 * Passing an empty conversation makes Claude open the session with a greeting.
 */
export async function getFeynmanReply(params: {
  topicTitle: string;
  summary: string;
  keyConcepts: string[];
  conversation: ConversationMessage[];
}): Promise<string> {
  const { topicTitle, summary, keyConcepts, conversation } = params;

  const systemPrompt = `You are a bright but completely clueless student who has been told to study the topic: "${topicTitle}".
A peer is about to explain this topic to you. Your job is to help them learn by asking genuine questions.

Rules you MUST follow:
- NEVER give the answer or explain the concept yourself — only ask questions.
- Ask one question at a time. Keep it short (1–2 sentences).
- Start friendly: "Hey! I heard you studied ${topicTitle}. Can you explain it to me?"
- Follow-up questions should probe understanding: "Why does that happen?", "What if it were different?", "Can you give a real-world example?", "What's the difference between X and Y?"
- If the student's explanation is vague, ask for more detail.
- If the student seems lost, gently ask what they do understand.
- After 4–5 exchanges, give a short encouraging or corrective summary (2 sentences max) and say you feel you understand better.
- Respond in the SAME LANGUAGE as the student. If they write in Hebrew, respond in Hebrew.

Topic context for your reference (do NOT reveal this to the student):
Summary: ${summary}
Key concepts: ${keyConcepts.slice(0, 8).join(", ")}`;

  // If no conversation yet, send an empty first user message to trigger Claude's opener
  const messages: Array<{ role: "user" | "assistant"; content: string }> =
    conversation.length === 0
      ? [{ role: "user", content: "start" }]
      : conversation;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return content.text.trim();
}

export interface FeynmanEvaluation {
  passed: boolean;
  score: number; // 0–1
  feedback: string;
}

/**
 * Evaluates the student's explanation across the full conversation.
 * Single-turn call — Claude reads the whole chat and judges understanding.
 */
export async function evaluateFeynmanSession(params: {
  topicTitle: string;
  keyConcepts: string[];
  conversation: ConversationMessage[];
}): Promise<FeynmanEvaluation> {
  const { topicTitle, keyConcepts, conversation } = params;

  const formatted = conversation
    .map((m) => `${m.role === "user" ? "Student" : "Bot"}: ${m.content}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    tools: [
      {
        name: "submit_feynman_evaluation",
        description: "Submit the evaluation of the student's teach-back session.",
        input_schema: {
          type: "object",
          properties: {
            passed: {
              type: "boolean",
              description:
                "true if the student showed reasonable understanding of the core concepts (score >= 0.6).",
            },
            score: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description:
                "0.0-1.0. 0.6 = basic understanding, 0.8 = solid, 1.0 = excellent.",
            },
            feedback: {
              type: "string",
              description:
                "2-3 sentences. What they explained well, what they missed. Same language as the student's messages.",
            },
          },
          required: ["passed", "score", "feedback"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_feynman_evaluation" },
    messages: [
      {
        role: "user",
        content: `You are evaluating a student's understanding of the topic: "${topicTitle}".

Key concepts they should have covered: ${keyConcepts.slice(0, 8).join(", ")}

Here is the full teaching conversation:
---
${formatted}
---

Evaluate ONLY the Student's messages. Did they demonstrate genuine understanding? Call the submit_feynman_evaluation tool with the result.`,
      },
    ],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    return { passed: false, score: 0, feedback: "Could not evaluate. Please try again." };
  }
  const input = toolUse.input as {
    passed: boolean;
    score: number;
    feedback: string;
  };
  return {
    passed: Boolean(input.passed),
    score: Math.max(0, Math.min(1, Number(input.score))),
    feedback: input.feedback ?? "",
  };
}
