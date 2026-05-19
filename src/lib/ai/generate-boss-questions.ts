import Anthropic from "@anthropic-ai/sdk";

export interface BossQuestion {
  type: "mcq" | "open";
  content: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: number;
  source_topics: string[];
}

/** A real exam question taken from the student's uploaded past exams.
 *  Used as a style + difficulty anchor when generating boss questions. */
export interface ExamSample {
  content: string;
  modelAnswer?: string;
  marks?: number;
}

export async function generateBossFightQuestions(params: {
  episodeTitle: string;
  courseSubject: string;
  topics: Array<{
    id: string;
    title: string;
    summary: string;
    keyConcepts: string[];
  }>;
  /** Real questions from past exams uploaded by the student. When present,
   *  the AI is instructed to match their style, depth, and difficulty
   *  rather than guessing at what a "boss-level" question looks like. */
  examSamples?: ExamSample[];
}): Promise<BossQuestion[]> {
  const { episodeTitle, courseSubject, topics, examSamples } = params;
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const hasExamSamples = !!examSamples && examSamples.length > 0;

  const topicDescriptions = topics
    .map(
      (t, i) =>
        `${i + 1}. "${t.title}" — ${t.summary}\n   Key concepts: ${t.keyConcepts.join(", ")}`
    )
    .join("\n");

  // Boss fights are the climactic exam for the whole episode — they should
  // feel comprehensive. Target 12–15 questions, scaled by topic count.
  //   4 topics  → 12     5 topics  → 13     6 topics  → 14     7+ topics → 15
  const questionCount = Math.min(Math.max(topics.length + 8, 12), 15);
  const mcqCount = Math.ceil(questionCount * 0.6);
  const openCount = questionCount - mcqCount;

  // Stream the response. Boss-question generation with a large max_tokens
  // can exceed the SDK's 10-minute non-streaming threshold, so we open a
  // stream and accumulate the final message. Streaming keeps the connection
  // alive while Claude writes, regardless of duration.
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    // 32768 keeps comfortable headroom for 15 questions with full MCQ
    // options + explanation + source_topics in Hebrew or other multi-byte
    // languages. Sonnet 4.6 supports up to 64k output tokens.
    max_tokens: 32768,
    messages: [
      {
        role: "user",
        content: `You are a university professor creating a comprehensive end-of-chapter exam that tests mastery across an entire chapter.

Course Subject: ${courseSubject}
Chapter/Episode: ${episodeTitle}

Topics covered in this chapter:
${topicDescriptions}
${
  hasExamSamples
    ? `

═══ STYLE & DIFFICULTY ANCHORS ═══
The student has uploaded ${examSamples!.length} REAL past-exam question(s) from this course. Your generated questions MUST match these in:
- Difficulty level (don't go harder, don't go easier)
- Tone and phrasing style
- Depth of conceptual reasoning expected
- Length and detail of model answers
- Whether they lean on pseudocode, derivations, definitions, scenarios, etc.

These are the calibration anchors — treat them as if they came from the same exam you're writing for:

${examSamples!
  .map(
    (s, i) =>
      `── Past exam question ${i + 1}${s.marks ? ` (${s.marks} marks)` : ""} ──\n${s.content}${
        s.modelAnswer ? `\n\nModel answer: ${s.modelAnswer.slice(0, 800)}` : ""
      }`
  )
  .join("\n\n")}

═══ END ANCHORS ═══
`
    : `

═══ DIFFICULTY GUIDANCE ═══
No past-exam samples are available for this course, so calibrate to a typical university final-exam level: CHALLENGING BUT FAIR. A student who has thoroughly understood the chapter should be able to solve most questions. Avoid cruelty — no obscure edge cases, no trick wording, no questions that depend on knowledge from outside this chapter.
═══ END GUIDANCE ═══
`
}

Create a comprehensive end-of-chapter exam with exactly ${questionCount} questions: ${mcqCount} multiple-choice and ${openCount} open-ended.

REQUIREMENTS:
1. Difficulty distribution: weighted toward 3-4 on a 1-5 scale. Include a handful of 2s (warm-up checks) and at most 2-3 questions at 5 (the toughest). No extreme/trick questions.
2. Some questions (around 30-50%) should span 2+ topics — those that naturally connect. Don't force synthesis on every question; some single-topic depth questions are good.
3. Open-ended questions should ask the student to explain, compare, derive, or apply — not just recite a definition.
4. MCQ distractors should be plausible — common misconceptions or near-misses, not obviously wrong.${
  hasExamSamples ? "\n5. **Match the anchor questions above** in tone, difficulty, and depth. This is the most important requirement." : ""
}

For each question, list which topic titles it draws from in "source_topics".

Return ONLY a JSON array:
[
  {
    "type": "mcq",
    "content": "A challenging question that combines concepts from multiple topics?",
    "options": ["A. Option one", "B. Option two", "C. Option three", "D. Option four"],
    "correct_answer": "A. Option one",
    "explanation": "Detailed explanation of the correct answer and why others are wrong",
    "difficulty": 4,
    "source_topics": ["Topic Title 1", "Topic Title 2"]
  },
  {
    "type": "open",
    "content": "An open-ended question requiring synthesis across topics?",
    "options": null,
    "correct_answer": "A comprehensive model answer",
    "explanation": "Rubric and grading criteria",
    "difficulty": 5,
    "source_topics": ["Topic Title 1", "Topic Title 3"]
  }
]

Rules:
- MCQ options MUST start with "A.", "B.", "C.", "D."
- correct_answer for MCQ must be the EXACT text of the correct option including letter prefix
- source_topics must use exact topic titles from the list above
- IMPORTANT: All text MUST be in the SAME LANGUAGE as the topics provided. If Hebrew, write in Hebrew. If English, write in English.

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
- For TABULAR DATA (process timing tables, scheduling tables, comparison tables, lookup tables) — **always** use GFM Markdown table syntax with pipes and dashes. NEVER use whitespace-aligned text or code blocks for tables. The renderer applies proper borders, padding, and forces LTR for tables. Example for a CPU scheduling problem:

  | Process | Arrival | Burst |
  | ------- | ------- | ----- |
  | P1      | 0       | 8     |
  | P2      | 1       | 4     |
  | P3      | 2       | 9     |

  This applies inside Hebrew prose too — write the table cells in whatever language fits, but use the pipe syntax so the renderer can produce a real \`<table>\`.
- Use \`\\n\` for line breaks inside JSON string values. Backticks and code fences must appear literally inside the JSON strings.
- Return ONLY valid JSON array, no extra prose, no surrounding markdown fences around the array itself.`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  return parseBossQuestionsJson(content.text.trim());
}

/**
 * Defensive parser for Claude's JSON-array output.
 *
 * Claude occasionally returns:
 *  - JSON wrapped in markdown fences (```json ... ```)
 *  - Prose before the array
 *  - A response truncated mid-object when output runs long (common with
 *    multi-byte languages like Hebrew that consume more BPE tokens)
 *
 * Strategy:
 *  1. Try a direct JSON.parse.
 *  2. Strip code fences and try again.
 *  3. Extract the bracketed array region and try.
 *  4. If still invalid, treat it as truncated: keep only complete top-level
 *     objects (parsing each candidate object body) and rebuild the array.
 */
function parseBossQuestionsJson(raw: string): BossQuestion[] {
  // 1. Direct parse
  try {
    return JSON.parse(raw) as BossQuestion[];
  } catch {}

  // 2. Strip markdown code fences if present
  const fenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (fenced !== raw) {
    try {
      return JSON.parse(fenced) as BossQuestion[];
    } catch {}
  }

  // 3. Extract first `[` to last `]` and try
  const startIdx = fenced.indexOf("[");
  const endIdx = fenced.lastIndexOf("]");
  if (startIdx === -1) {
    throw new Error("Could not extract JSON array from boss questions response");
  }
  if (endIdx > startIdx) {
    const slice = fenced.slice(startIdx, endIdx + 1);
    try {
      return JSON.parse(slice) as BossQuestion[];
    } catch {}
  }

  // 4. Repair-mode: scan the array body and collect complete top-level objects.
  //    This salvages a truncated response by keeping every fully-formed
  //    question and dropping the partial one at the end.
  const body = fenced.slice(startIdx + 1);
  const objects: BossQuestion[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const candidate = body.slice(objStart, i + 1);
        try {
          objects.push(JSON.parse(candidate) as BossQuestion);
        } catch {
          // Skip malformed individual object — keep going.
        }
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) {
      // Reached array terminator (rare here — would've matched step 3).
      break;
    }
  }

  if (objects.length === 0) {
    throw new Error(
      "Could not extract any complete boss question objects from response (response may have been truncated)"
    );
  }

  return objects;
}
