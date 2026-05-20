import Anthropic from "@anthropic-ai/sdk";

export interface ExamGradingResult {
  score: number;
  feedback: string;
}

export interface StudentAnswerImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

export async function gradeExamAnswer(params: {
  question: string;
  modelAnswer: string;
  marks: number;
  studentAnswer: string;
  mode: "timed" | "assisted";
  /** Optional diagram / hand-written work attached by the student. */
  studentImage?: StudentAnswerImage | null;
}): Promise<ExamGradingResult> {
  const { question, modelAnswer, marks, studentAnswer, mode, studentImage } = params;
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const hasText = studentAnswer.trim().length >= 3;
  const hasImage = !!studentImage;
  if (!hasText && !hasImage) {
    return { score: 0, feedback: "No answer was provided." };
  }

  const assistedExtra = mode === "assisted"
    ? `Since this is assisted mode, provide detailed teaching feedback:
- Explain the concept from first principles if the student got it wrong
- Reference which course topics they should revisit
- Be thorough and educational (4-6 sentences)`
    : `Since this is timed mode, keep feedback brief (1-2 sentences).`;

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
    text: `You are a university professor grading an exam answer.

Question (${marks} marks): ${question}

Model Answer / Rubric: ${modelAnswer}

Student's Typed Answer: ${hasText ? studentAnswer : "(no typed text — see attached image)"}
${hasImage ? "\nThe student attached an image (above) — a hand-drawn diagram, derivation, automaton, proof, or similar. Read it carefully and grade based on BOTH the typed text AND the image together. The drawing is part of their answer.\n" : ""}
${assistedExtra}

Score from 0.0 to 1.0 based on accuracy and completeness relative to the marks available.

Return ONLY a JSON object (no markdown):
{
  "score": 0.75,
  "feedback": "Your feedback here"
}

IMPORTANT: Write feedback in the SAME LANGUAGE as the question and student answer.`,
  });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: userContent,
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
    if (!match) return { score: 0, feedback: "Could not evaluate answer." };
    const result = JSON.parse(match[0]);
    return {
      score: Math.max(0, Math.min(1, Number(result.score))),
      feedback: result.feedback || "",
    };
  }
}

export interface ExamDebriefResult {
  predicted_score_pct: number;
  strongest_areas: string[];
  critical_gaps: string[];
  recommended_topics: string[];
  exam_readiness: "low" | "moderate" | "high" | "ready";
  summary: string;
}

export async function generateExamDebrief(params: {
  questions: Array<{ content: string; marks: number; key_topics: string[] }>;
  answers: Array<{ score: number; feedback: string }>;
  courseName: string;
}): Promise<ExamDebriefResult> {
  const { questions, answers, courseName } = params;
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const questionsWithResults = questions.map((q, i) => ({
    question: q.content.slice(0, 200),
    marks: q.marks,
    topics: q.key_topics,
    score: answers[i]?.score ?? 0,
  }));

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Student completed a past exam for "${courseName}". Analyze their performance.

Results:
${JSON.stringify(questionsWithResults, null, 2)}

Return ONLY a JSON object (no markdown):
{
  "predicted_score_pct": 68,
  "strongest_areas": ["topic1", "topic2"],
  "critical_gaps": ["topic3 — brief reason"],
  "recommended_topics": ["topic to study next", "another topic"],
  "exam_readiness": "moderate",
  "summary": "2-3 sentence overall assessment. Be direct but encouraging."
}

exam_readiness must be one of: "low" (< 50%), "moderate" (50-69%), "high" (70-84%), "ready" (85%+)
IMPORTANT: Write all text in the SAME LANGUAGE as the questions.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonText = content.text.trim();
  try {
    return JSON.parse(jsonText) as ExamDebriefResult;
  } catch {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse exam debrief");
    return JSON.parse(match[0]) as ExamDebriefResult;
  }
}
