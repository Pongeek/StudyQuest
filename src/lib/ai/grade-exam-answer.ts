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

Call the submit_exam_grade tool with the score and feedback.

IMPORTANT: Write feedback in the SAME LANGUAGE as the question and student answer.`,
  });

  // Tool use enforces schema at the API layer — no JSON parsing of
  // free-form text means no bad-escaped-character bugs on Hebrew/LaTeX.
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    tools: [
      {
        name: "submit_exam_grade",
        description: "Submit the graded score and feedback for the exam answer.",
        input_schema: {
          type: "object",
          properties: {
            score: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Score between 0.0 and 1.0 per the rubric and marks available.",
            },
            feedback: {
              type: "string",
              description:
                "Feedback for the student. Length depends on mode: 1-2 sentences in timed, 4-6 sentences in assisted. Same language as the student's answer.",
            },
          },
          required: ["score", "feedback"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_exam_grade" },
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
    return { score: 0, feedback: "Could not evaluate answer." };
  }
  const input = toolUse.input as { score: number; feedback: string };
  return {
    score: Math.max(0, Math.min(1, Number(input.score))),
    feedback: input.feedback || "",
  };
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
    tools: [
      {
        name: "submit_exam_debrief",
        description: "Submit the post-exam debrief analysis.",
        input_schema: {
          type: "object",
          properties: {
            predicted_score_pct: {
              type: "number",
              minimum: 0,
              maximum: 100,
              description: "Predicted exam score as a percentage (0-100).",
            },
            strongest_areas: {
              type: "array",
              items: { type: "string" },
              description: "Topics the student demonstrated strong understanding of.",
            },
            critical_gaps: {
              type: "array",
              items: { type: "string" },
              description: "Topics with critical gaps — brief one-line reasons.",
            },
            recommended_topics: {
              type: "array",
              items: { type: "string" },
              description: "Topics to study next, ordered by priority.",
            },
            exam_readiness: {
              type: "string",
              enum: ["low", "moderate", "high", "ready"],
              description: "Overall readiness level.",
            },
            summary: {
              type: "string",
              description:
                "2-3 sentence overall assessment. Direct but encouraging. Same language as the questions.",
            },
          },
          required: [
            "predicted_score_pct",
            "strongest_areas",
            "critical_gaps",
            "recommended_topics",
            "exam_readiness",
            "summary",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_exam_debrief" },
    messages: [
      {
        role: "user",
        content: `Student completed a past exam for "${courseName}". Analyze their performance.

Results:
${JSON.stringify(questionsWithResults, null, 2)}

Call the submit_exam_debrief tool with the analysis. Mapping:
- exam_readiness: "low" (< 50%), "moderate" (50-69%), "high" (70-84%), "ready" (85%+)

IMPORTANT: Write all text in the SAME LANGUAGE as the questions.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) throw new Error("Could not parse exam debrief");
  return toolUse.input as ExamDebriefResult;
}
