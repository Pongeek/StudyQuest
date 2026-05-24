import Anthropic from "@anthropic-ai/sdk";
import { COACH_PERSONA_SYSTEM } from "@/lib/ai/coach-persona";

export interface GradingResult {
  score: number;
  feedback: string;
}

/**
 * Optional image attached to the student's answer (e.g. a hand-drawn DFA,
 * derivation, or proof). When present, Claude grades both the typed text
 * AND the image together using its vision capability.
 */
export interface StudentAnswerImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  /** base64-encoded image content (no data: prefix) */
  base64: string;
}

export async function gradeOpenAnswer(params: {
  question: string;
  modelAnswer: string;
  explanation: string;
  studentAnswer: string;
  topicTitle: string;
  /** When set, Claude sees the image as an additional content block. */
  studentImage?: StudentAnswerImage | null;
}): Promise<GradingResult> {
  const { question, modelAnswer, explanation, studentAnswer, topicTitle, studentImage } = params;

  // Surface a clear, actionable error during deploys / first run when the
  // CLAUDE_API_KEY env var isn't set — without this, the SDK throws a
  // cryptic "401 invalid API key" that's hard to trace from the UI.
  if (!process.env.CLAUDE_API_KEY) {
    throw new Error(
      "CLAUDE_API_KEY is not set. Add it to your Vercel project environment variables (Settings → Environment Variables) and redeploy."
    );
  }

  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  // "No answer" check — but if the student attached a diagram image with no
  // text, that's still a valid answer (their work is in the picture).
  const hasText = studentAnswer.trim().length >= 5;
  const hasImage = !!studentImage;
  if (!hasText && !hasImage) {
    return {
      score: 0,
      feedback: "No answer was provided. Try to explain your understanding even if you're unsure — or attach a diagram if drawing is easier.",
    };
  }

  // Build the message content. When the student attached an image, we
  // include it as a vision content block alongside the instruction text.
  // Claude will read both the typed answer AND the image when grading.
  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  if (studentImage) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: studentImage.mediaType,
        data: studentImage.base64,
      },
    });
  }
  userContent.push({
    type: "text",
    text: `You are a university professor grading a student's answer. Be fair, encouraging, and specific.

Topic: ${topicTitle}
Question: ${question}

Model Answer: ${modelAnswer}
Grading Rubric: ${explanation}

Student's Typed Answer: ${hasText ? studentAnswer : "(no typed text — see attached image)"}
${hasImage ? "\nThe student ALSO attached an image (above) — a hand-drawn diagram, derivation, proof, automaton, or similar. Read it carefully and grade based on BOTH the typed text AND the image together. The drawing is part of their answer, not optional.\n" : ""}
Evaluate the student's answer based on conceptual accuracy and completeness.
Score from 0.0 to 1.0:
- 0.9-1.0: Excellent, covers all key points with understanding
- 0.7-0.89: Good, covers most key points with minor gaps
- 0.5-0.69: Partial, shows some understanding but missing important aspects
- 0.0-0.49: Insufficient, significant misconceptions or missing key concepts

Call the submit_grade tool with the score and feedback.

IMPORTANT: Write the feedback in the SAME LANGUAGE as the question and student answer. If they are in Hebrew, respond in Hebrew.`,
  });

  // Tool use enforces the response schema at the API layer — no JSON.parse,
  // no escape-character bugs on Hebrew/LaTeX feedback. Anthropic validates
  // the returned object against `input_schema` before delivering it.
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    // Loremaster persona — coats the feedback in a consistent coach voice
    // across grader / scroll / debrief. The user content below still
    // carries the rubric and task instructions; persona only flavors tone.
    system: COACH_PERSONA_SYSTEM,
    tools: [
      {
        name: "submit_grade",
        description: "Submit the graded score and feedback for the student's answer.",
        input_schema: {
          type: "object",
          properties: {
            score: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Score between 0.0 and 1.0 per the rubric above.",
            },
            feedback: {
              type: "string",
              description:
                "Encouraging, specific feedback in 2-3 sentences. Mention what they got right, what they missed, and a hint about the gap. Same language as the student's answer.",
            },
          },
          required: ["score", "feedback"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_grade" },
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    return { score: 0, feedback: "Could not evaluate answer. Please try again." };
  }
  const input = toolUse.input as { score: number; feedback: string };
  return {
    score: Math.max(0, Math.min(1, Number(input.score))),
    feedback: input.feedback || "",
  };
}
