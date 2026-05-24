import Anthropic from "@anthropic-ai/sdk";
import { COACH_PERSONA_SYSTEM } from "@/lib/ai/coach-persona";
import type { GeneratedQuestion, OutputLanguage } from "@/lib/ai/generate-questions";

/**
 * Single-question regenerator. Called when a student taps "🔄 regenerate"
 * on a question that's ambiguous, hallucinated, or otherwise busted.
 *
 * Returns ONE replacement question of the same type and roughly the same
 * difficulty, covering the same concept but rephrased / re-angled.
 *
 * Uses Anthropic tool-use for schema-enforced output. Mirrors the full
 * generator's prompt vocabulary (LaTeX rules, language rule, Markdown
 * formatting) so the replacement renders identically in the engine.
 */
function buildLanguageRule(lang: OutputLanguage): string {
  if (lang === "en") {
    return "- CRITICAL LANGUAGE RULE: Write ALL output text (question, options, answer, explanation) in ENGLISH. This overrides any other language signal.";
  }
  if (lang === "he") {
    return "- CRITICAL LANGUAGE RULE: Write ALL output text (question, options, answer, explanation) in HEBREW. This overrides any other language signal.";
  }
  return "- IMPORTANT: All text MUST be in the SAME LANGUAGE as the topic summary and the rejected question.";
}

export async function regenerateQuestion(params: {
  topicTitle: string;
  topicSummary: string;
  keyConcepts: string[];
  episodeTitle: string;
  courseSubject: string;
  /** The question the student rejected. We reuse its type + difficulty +
   *  give Claude the original text so it knows what to rephrase / avoid. */
  oldQuestion: {
    type: "mcq" | "open";
    content: string;
    correct_answer: string;
    difficulty: number;
  };
  outputLanguage?: OutputLanguage;
}): Promise<GeneratedQuestion> {
  const {
    topicTitle,
    topicSummary,
    keyConcepts,
    episodeTitle,
    courseSubject,
    oldQuestion,
  } = params;
  const outputLanguage = params.outputLanguage ?? "auto";

  if (!process.env.CLAUDE_API_KEY) {
    throw new Error(
      "CLAUDE_API_KEY is not set. Add it to Vercel project env (Settings → Environment Variables) and redeploy."
    );
  }

  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    // Loremaster persona for tone consistency across the AI surface.
    // Persona has no impact on the schema — it just keeps voice consistent
    // if any of the explanation text leaks into the UI.
    system: COACH_PERSONA_SYSTEM,
    tools: [
      {
        name: "save_replacement_question",
        description:
          "Save ONE replacement question for a topic. Must be the same type as the rejected question.",
        input_schema: {
          type: "object" as const,
          properties: {
            type: {
              type: "string",
              enum: ["mcq", "open"],
              description: "MUST match the rejected question's type.",
            },
            content: {
              type: "string",
              description:
                "Question text in Markdown. Math uses LaTeX in $...$ or $$...$$. Pseudocode in fenced code blocks.",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description:
                "MCQ ONLY: 4 options each starting 'A. ', 'B. ', 'C. ', 'D. '. Omit for open.",
            },
            correct_answer: {
              type: "string",
              description:
                "MCQ: exact text of the correct option (with letter prefix). Open: model answer.",
            },
            explanation: {
              type: "string",
              description: "Markdown explanation of why the correct answer is right.",
            },
            difficulty: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              description: "Roughly match the rejected question's difficulty.",
            },
          },
          required: ["type", "content", "correct_answer", "explanation", "difficulty"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "save_replacement_question" },
    messages: [
      {
        role: "user",
        content: `A student rejected the question below as ambiguous, hallucinated, or otherwise low-quality. Generate ONE replacement question on the same concept, of the SAME TYPE (${oldQuestion.type}) and roughly the same difficulty (${oldQuestion.difficulty}/5).

Course Subject: ${courseSubject}
Episode: ${episodeTitle}
Topic: ${topicTitle}
Summary: ${topicSummary}
Key Concepts: ${keyConcepts.join(", ")}

REJECTED QUESTION (do NOT just rephrase its surface text — produce a meaningfully different question on the same concept):
"""
${oldQuestion.content}
"""
Its current correct answer:
"""
${oldQuestion.correct_answer}
"""

Call save_replacement_question with the new question.

Critical rules:
- Same type as rejected (${oldQuestion.type}).
- Same concept — pull a different angle or example from the topic's key concepts.
- Concrete, unambiguous. Single defensible correct answer. If the rejected question was unclear about what is being asked, the replacement MUST make the ask explicit.
- For MCQ: 4 options, all starting "A.", "B.", "C.", "D.". correct_answer = the EXACT option text including the prefix. Distractors must be plausibly wrong, not obviously off-topic.
- For open: require conceptual understanding/explanation — NOT a one-word factual recall.
${buildLanguageRule(outputLanguage)}

FORMATTING (the renderer is KaTeX + GFM Markdown — must preserve LaTeX exactly):
- Inline math: $...$ ; display math: $$...$$
- Greek letters, set-builder notation, quantifiers, subscripts/superscripts — keep them in LaTeX (\\Sigma, \\delta, \\forall, q_0, 2^n, |w|, L^*, \\cup, \\in, \\to).
- Pseudocode in fenced \`\`\` blocks, single identifiers in single backticks.
- Tables in GFM pipe syntax.
- Translate any Unicode math symbols (∈ → \\in, ∀ → \\forall, → → \\to) into LaTeX.

CALL the tool. No prose response.`,
      },
    ],
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error(
      `Claude did not call save_replacement_question (stop_reason=${message.stop_reason}, content types=${message.content.map((b) => b.type).join(",")})`
    );
  }
  const input = toolUse.input as Partial<GeneratedQuestion>;
  if (!input.type || !input.content || !input.correct_answer) {
    throw new Error(
      `Tool input missing required fields. Got: ${JSON.stringify(input).slice(0, 300)}`
    );
  }
  // Sanitize options: undefined (not empty array) for open questions.
  return {
    type: input.type,
    content: input.content,
    options:
      input.type === "mcq" && Array.isArray(input.options) && input.options.length > 0
        ? input.options
        : undefined,
    correct_answer: input.correct_answer,
    explanation: input.explanation ?? "",
    difficulty: typeof input.difficulty === "number" ? input.difficulty : oldQuestion.difficulty,
  };
}
