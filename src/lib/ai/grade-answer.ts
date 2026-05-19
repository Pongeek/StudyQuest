import Anthropic from "@anthropic-ai/sdk";

export interface GradingResult {
  score: number;
  feedback: string;
}

export async function gradeOpenAnswer(params: {
  question: string;
  modelAnswer: string;
  explanation: string;
  studentAnswer: string;
  topicTitle: string;
}): Promise<GradingResult> {
  const { question, modelAnswer, explanation, studentAnswer, topicTitle } = params;
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  if (!studentAnswer.trim() || studentAnswer.trim().length < 5) {
    return {
      score: 0,
      feedback: "No answer was provided. Try to explain your understanding even if you're unsure.",
    };
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are a university professor grading a student's answer. Be fair, encouraging, and specific.

Topic: ${topicTitle}
Question: ${question}

Model Answer: ${modelAnswer}
Grading Rubric: ${explanation}

Student's Answer: ${studentAnswer}

Evaluate the student's answer based on conceptual accuracy and completeness.
Score from 0.0 to 1.0:
- 0.9-1.0: Excellent, covers all key points with understanding
- 0.7-0.89: Good, covers most key points with minor gaps
- 0.5-0.69: Partial, shows some understanding but missing important aspects
- 0.0-0.49: Insufficient, significant misconceptions or missing key concepts

Return ONLY a JSON object (no markdown):
{
  "score": 0.85,
  "feedback": "Encouraging, specific feedback in 2-3 sentences. Mention what they got right, what they missed, and a hint about the gap."
}

IMPORTANT: Write the feedback in the SAME LANGUAGE as the question and student answer. If they are in Hebrew, respond in Hebrew.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonText = content.text.trim();
  try {
    const result = JSON.parse(jsonText);
    return {
      score: Math.max(0, Math.min(1, Number(result.score))),
      feedback: result.feedback || "",
    };
  } catch {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) return { score: 0, feedback: "Could not evaluate answer. Please try again." };
    const result = JSON.parse(match[0]);
    return {
      score: Math.max(0, Math.min(1, Number(result.score))),
      feedback: result.feedback || "",
    };
  }
}
