import Anthropic from "@anthropic-ai/sdk";

export interface GeneratedQuestion {
  type: "mcq" | "open";
  content: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: number;
}

export type OutputLanguage = "auto" | "en" | "he";

function buildLanguageRule(lang: OutputLanguage): string {
  if (lang === "en") {
    return "- CRITICAL LANGUAGE RULE: Write ALL output text (questions, options, answers, explanations) in ENGLISH, EVEN IF the topic/summary is in a different language. The student chose English course content. This overrides any other language instruction.";
  }
  if (lang === "he") {
    return "- CRITICAL LANGUAGE RULE: Write ALL output text (questions, options, answers, explanations) in HEBREW, EVEN IF the topic/summary is in a different language. The student chose Hebrew course content. This overrides any other language instruction.";
  }
  return "- IMPORTANT: All text (questions, options, answers, explanations) MUST be in the SAME LANGUAGE as the topic/summary provided. If the topic is in Hebrew, write everything in Hebrew. If in English, write in English.";
}

export async function generateTopicQuestions(params: {
  topicTitle: string;
  topicSummary: string;
  keyConcepts: string[];
  episodeTitle: string;
  courseSubject: string;
  difficulty: number;
  /** Number of pages this topic covers (used to scale question count) */
  pageCount?: number;
  /** Output language override — defaults to 'auto' (match source) */
  outputLanguage?: OutputLanguage;
}): Promise<GeneratedQuestion[]> {
  const { topicTitle, topicSummary, keyConcepts, episodeTitle, courseSubject, difficulty, pageCount } = params;
  const outputLanguage = params.outputLanguage ?? "auto";
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  // Scale question count based on content size:
  // 1-2 pages → 6 questions (4 MCQ + 2 open)
  // 3-4 pages → 8 questions (5 MCQ + 3 open)
  // 5+ pages  → 10 questions (6 MCQ + 4 open)
  let mcqCount = 5;
  let openCount = 3;
  if (pageCount && pageCount >= 5) {
    mcqCount = 6;
    openCount = 4;
  } else if (pageCount && pageCount <= 2) {
    mcqCount = 4;
    openCount = 2;
  }

  const totalCount = mcqCount + openCount;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a university professor creating exam questions. Generate questions for the following topic.

Course Subject: ${courseSubject}
Episode: ${episodeTitle}
Topic: ${topicTitle}
Summary: ${topicSummary}
Key Concepts: ${keyConcepts.join(", ")}
Topic Difficulty: ${difficulty}/5

Generate exactly ${totalCount} questions: ${mcqCount} multiple-choice questions and ${openCount} open-ended questions.

Return ONLY a JSON array with this exact structure:
[
  {
    "type": "mcq",
    "content": "Question text here?",
    "options": ["A. Option one", "B. Option two", "C. Option three", "D. Option four"],
    "correct_answer": "A. Option one",
    "explanation": "Explanation of why this is correct and why others are wrong",
    "difficulty": 3
  },
  {
    "type": "open",
    "content": "Open-ended question that requires conceptual understanding?",
    "options": null,
    "correct_answer": "A comprehensive model answer covering the key points a student should mention",
    "explanation": "Rubric: what makes a complete answer and what partial credit looks like",
    "difficulty": 4
  }
]

Critical rules:
- Generate exactly ${mcqCount} MCQ questions and ${openCount} open-ended questions (${totalCount} total)
- MCQ options MUST start with "A.", "B.", "C.", "D."
- correct_answer for MCQ must be the EXACT text of the correct option including the letter prefix
- Open questions must require conceptual understanding and analysis, NOT just memorization or definition recall
- Open questions should require the student to explain, compare, apply, or analyze
- Spread questions across ALL key concepts — do not cluster questions on a single concept
- Vary difficulty: include a mix of easier (1-2) and harder (4-5) questions
- difficulty is 1-5 per question
${buildLanguageRule(outputLanguage)}

FORMATTING RULES (CRITICAL — questions often contain pseudocode):
- Format the "content" / "options" / "correct_answer" / "explanation" fields as **Markdown**.
- Wrap any pseudocode block (multi-line code, function bodies, control structures) in a fenced code block:
      \`\`\`
      lock(m);
      while (!condition) {
          wait(cv, m);
      }
      unlock(m);
      \`\`\`
  Use real line breaks and proper indentation inside the fence. Never inline a multi-line snippet into the prose.
- Wrap single identifiers / function calls / inline expressions in single backticks: \`mutex\`, \`lock(m)\`, \`signal(cv)\`, \`condition=true\`.
- Keep code in its source language (English / Latin script) even when the surrounding prose is Hebrew. The renderer forces LTR direction on code so identifiers like \`lock(m)\` won't get reversed.
- For TABULAR DATA (timing tables, comparison tables, lookup tables) — **always** use GFM Markdown table syntax with pipes and dashes. NEVER use whitespace-aligned text or code blocks for tables. The renderer applies proper borders, padding, and forces LTR for tables. Example:

  | Process | Arrival | Burst |
  | ------- | ------- | ----- |
  | P1      | 0       | 8     |
  | P2      | 1       | 4     |
- Use \`\\n\` for line breaks inside JSON string values. Backticks and code fences must appear literally inside the JSON strings.
- Return ONLY valid JSON array, no extra prose, no surrounding markdown fences around the array itself.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonText = content.text.trim();
  try {
    return JSON.parse(jsonText) as GeneratedQuestion[];
  } catch {
    const match = jsonText.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Could not extract JSON from questions response");
    return JSON.parse(match[0]) as GeneratedQuestion[];
  }
}
