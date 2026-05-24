import Anthropic from "@anthropic-ai/sdk";
import { COACH_PERSONA_SYSTEM } from "@/lib/ai/coach-persona";

export interface SessionDebrief {
  strengths: string[];
  gaps: string[];
  next_topic: string;
  reason: string;
}

export async function generateSessionDebrief(params: {
  topicTitle: string;
  answers: Array<{
    question: string;
    userAnswer: string;
    score: number;
    feedback: string;
  }>;
  availableNextTopics: string[];
}): Promise<SessionDebrief> {
  const { topicTitle, answers, availableNextTopics } = params;
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const resultsText = answers
    .map(
      (a, i) =>
        `Q${i + 1}: ${a.question}\nStudent: ${a.userAnswer}\nScore: ${a.score.toFixed(2)}\nFeedback: ${a.feedback}`
    )
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    // Loremaster persona — debrief voice. The persona's tone rule for
    // debriefs is "brief assessment, then next move, no motivational speech."
    system: COACH_PERSONA_SYSTEM,
    tools: [
      {
        name: "submit_session_debrief",
        description: "Submit the post-quiz coaching debrief.",
        input_schema: {
          type: "object",
          properties: {
            strengths: {
              type: "array",
              items: { type: "string" },
              description: "2-3 concepts the student clearly understood. Be specific.",
            },
            gaps: {
              type: "array",
              items: { type: "string" },
              description:
                "1-3 specific concepts that need more work, based on wrong/partial answers. Empty array if all answers were perfect.",
            },
            next_topic: {
              type: "string",
              description: `The single best next topic from the available list, or 'Review ${topicTitle}' if they scored poorly.`,
            },
            reason: {
              type: "string",
              description: "One sentence explaining why this next topic is recommended.",
            },
          },
          required: ["strengths", "gaps", "next_topic", "reason"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_session_debrief" },
    messages: [
      {
        role: "user",
        content: `You are a study coach reviewing a student's quiz performance on "${topicTitle}".

Quiz Results:
${resultsText}

Available next topics to recommend from: ${availableNextTopics.join(", ") || "None (course complete)"}

Call the submit_session_debrief tool with the analysis.

Rules:
- next_topic must be from the available topics list or "Review ${topicTitle}"
- Keep everything concise and actionable
- IMPORTANT: Write all text in the SAME LANGUAGE as the topic and quiz content. If they are in Hebrew, write in Hebrew.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    return {
      strengths: ["Quiz completed"],
      gaps: [],
      next_topic: availableNextTopics[0] || topicTitle,
      reason: "Continue to the next topic.",
    };
  }
  return toolUse.input as SessionDebrief;
}
