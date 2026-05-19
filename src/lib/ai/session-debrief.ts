import Anthropic from "@anthropic-ai/sdk";

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
    messages: [
      {
        role: "user",
        content: `You are a study coach reviewing a student's quiz performance on "${topicTitle}".

Quiz Results:
${resultsText}

Available next topics to recommend from: ${availableNextTopics.join(", ") || "None (course complete)"}

Based on the quiz results, provide a brief debrief. Return ONLY this JSON (no markdown):
{
  "strengths": ["2-3 concepts the student clearly understood"],
  "gaps": ["1-3 specific concepts that need more work, based on wrong/partial answers"],
  "next_topic": "The single best next topic from the available list, or 'Review ${topicTitle}' if they scored poorly",
  "reason": "One sentence explaining why this next topic is recommended"
}

Rules:
- strengths: be specific about what concepts they demonstrated knowledge of
- gaps: identify specific knowledge gaps from wrong/partial answers, not just "needs improvement"
- If all answers were correct (score 1.0), gaps should be empty []
- next_topic must be from the available topics list or "Review ${topicTitle}"
- Keep everything concise and actionable
- IMPORTANT: Write all text in the SAME LANGUAGE as the topic and quiz content. If they are in Hebrew, write in Hebrew.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonText = content.text.trim();
  try {
    return JSON.parse(jsonText) as SessionDebrief;
  } catch {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        strengths: ["Quiz completed"],
        gaps: [],
        next_topic: availableNextTopics[0] || topicTitle,
        reason: "Continue to the next topic.",
      };
    }
    return JSON.parse(match[0]) as SessionDebrief;
  }
}
