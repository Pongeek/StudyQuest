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

MATH / LOGIC / FORMAL NOTATION (CRITICAL — applies to math, CS theory, logic, formal methods):
- The downstream renderer supports KaTeX. Wrap inline math in \`$...$\` and display math in \`$$...$$\` (using ACTUAL dollar signs, written into the JSON string).
- Examples of content you MUST preserve in LaTeX:
  - Set-builder notation: \`$\\{w \\in \\{0,1\\}^* \\mid |w| \\text{ is a multiple of } 3\\}$\`
  - Quantifiers / logic: \`$\\forall x \\in S, \\exists y$\`
  - Greek letters: \`$\\Sigma\`, \`$\\delta$\`, \`$\\epsilon$\`, \`$\\lambda$\`
  - Kleene star and operators: \`$L^*$\`, \`$\\cup$\`, \`$\\cap$\`, \`$\\to$\`
  - Subscripts / superscripts: \`$q_0$\`, \`$2^n$\`, \`$\\Sigma^*$\`
  - Cardinality / absolute value: \`$|w|$\`, \`$|S|$\`
- If a question references a language, set, or formal object, INCLUDE the full LaTeX definition inline — never write "see the textbook" or paraphrase symbols in words.
- Translate any unicode math symbols (\\u2208 ∈, \\u2227 ∧, \\u2200 ∀, \\u2192 →) to LaTeX (\`\\in\`, \`\\wedge\`, \`\\forall\`, \`\\to\`) wrapped in dollar signs.

- Return ONLY valid JSON array, no extra prose, no surrounding markdown fences around the array itself.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  return parseQuestionsArray(content.text.trim());
}

/**
 * 4-stage defensive JSON parser for the questions array. Same approach as
 * the course-extraction parser — handles code fences, surrounding prose,
 * smart quotes, and trailing commas before giving up.
 */
function parseQuestionsArray(raw: string): GeneratedQuestion[] {
  // Stage 1 — direct parse
  try {
    return JSON.parse(raw) as GeneratedQuestion[];
  } catch { /* fall through */ }

  // Stage 2 — strip Markdown code fences
  let cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as GeneratedQuestion[];
  } catch { /* fall through */ }

  // Stage 3 — bracket-slice between the first `[` and last `]`
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(cleaned) as GeneratedQuestion[];
    } catch { /* fall through */ }
  }

  // Stage 4 — repair common malformations (smart quotes, trailing commas)
  let repaired = cleaned
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(repaired) as GeneratedQuestion[];
  } catch { /* fall through */ }

  // Stage 5 — escape raw control chars (newlines, tabs, CR) that Claude
  // sometimes leaves UNESCAPED inside string values. JSON forbids these.
  // We walk the string with a tiny state machine that tracks whether we're
  // currently inside a JSON string literal.
  repaired = escapeControlCharsInStrings(repaired);

  try {
    return JSON.parse(repaired) as GeneratedQuestion[];
  } catch { /* fall through */ }

  // Stage 6 — insert missing commas between adjacent JSON values. Claude
  // sometimes forgets the comma between `"options": [...]` and the next
  // property `"correct_answer": "..."`, or between two array elements.
  // Pattern: a value-ending token (closing ", ], or }) immediately followed
  // (after whitespace) by another value-starting token ("`, `[`, `{`).
  repaired = insertMissingCommas(repaired);

  try {
    return JSON.parse(repaired) as GeneratedQuestion[];
  } catch (err) {
    // Surface CONTEXT around the failure position so the next debugging
    // session has actionable info instead of just "position 5514".
    const errMsg = err instanceof Error ? err.message : String(err);
    const posMatch = errMsg.match(/position (\d+)/);
    const pos = posMatch ? parseInt(posMatch[1], 10) : 0;
    const context = repaired
      .slice(Math.max(0, pos - 120), pos + 120)
      .replace(/\s+/g, " ");
    const preview = raw.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `Could not parse questions JSON after 6 repair stages. ` +
      `Failure at char ${pos}. ` +
      `Context (±120 chars around failure): ${JSON.stringify(context)}. ` +
      `Head of raw response: ${preview}... ` +
      `(original error: ${errMsg})`
    );
  }
}

/**
 * Insert commas between adjacent JSON values. Walks the string with a state
 * machine (so we don't insert commas inside string literals by accident).
 * Triggers when a value-ending token (closing `"`, `]`, or `}`) is followed
 * — after whitespace only — by a value-starting token (`"`, `[`, `{`, or
 * a literal like `true`, `false`, `null`, or a number).
 *
 * Claude's most common JSON formatting bug in long responses is forgetting
 * the comma between `"options": [...]` and the next sibling property.
 */
function insertMissingCommas(input: string): string {
  let out = "";
  let inString = false;
  let escapeNext = false;
  let lastNonWs = ""; // last non-whitespace char EMITTED (not inside a string)

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (escapeNext) {
      out += c;
      escapeNext = false;
      continue;
    }
    if (c === "\\" && inString) {
      out += c;
      escapeNext = true;
      continue;
    }
    if (c === '"') {
      if (inString) {
        // Closing a string — emit, then track this as a value-ender.
        out += c;
        lastNonWs = '"';
        inString = false;
        continue;
      } else {
        // Opening a string — check if we need to insert a comma first.
        if (lastNonWs === '"' || lastNonWs === "]" || lastNonWs === "}") {
          out += ",";
        }
        out += c;
        lastNonWs = '"'; // reset; we're now inside a string
        inString = true;
        continue;
      }
    }

    if (inString) {
      out += c;
      continue;
    }

    // Outside string — handle structural tokens
    if (c === "[" || c === "{") {
      if (lastNonWs === '"' || lastNonWs === "]" || lastNonWs === "}") {
        out += ",";
      }
      out += c;
      lastNonWs = c;
      continue;
    }
    if (c === "]" || c === "}") {
      out += c;
      lastNonWs = c;
      continue;
    }
    if (/\s/.test(c)) {
      out += c;
      continue; // don't update lastNonWs
    }

    // Any other char (number digit, letter for true/false/null, etc.)
    out += c;
    lastNonWs = c;
  }

  return out;
}

/**
 * Walks a JSON-ish string and escapes any raw newlines, tabs, or carriage
 * returns that appear INSIDE string literals. Outside strings these chars
 * are valid whitespace; inside strings they're invalid (must be `\n`, `\t`,
 * `\r`). Claude occasionally produces strings containing raw newlines in
 * long, complex responses — this stage rescues them.
 */
function escapeControlCharsInStrings(input: string): string {
  let out = "";
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escapeNext) {
      out += c;
      escapeNext = false;
      continue;
    }
    if (c === "\\") {
      out += c;
      escapeNext = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      out += c;
      continue;
    }
    if (inString) {
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
    }
    out += c;
  }
  return out;
}
