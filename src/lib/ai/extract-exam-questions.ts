import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedExamQuestion {
  type: "mcq" | "open";
  content: string;
  options?: string[];        // MCQ only — undefined for open questions
  correct_answer?: string;   // MCQ only — must exactly match one of the options strings
  model_answer: string;
  marks: number;
  key_topics: string[];
}

export async function extractExamQuestions(
  pdfText: string,
  courseTopic: string
): Promise<ExtractedExamQuestion[]> {
  const truncatedText = pdfText.slice(0, 80000);
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  // Stream the response. Past exams in Hebrew (or with many questions) can
  // easily exceed the SDK's 10-minute non-streaming threshold and the old
  // 8192-token cap was truncating mid-array. 32768 keeps comfortable
  // headroom; Sonnet 4.6 supports up to 64k output.
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 32768,
    messages: [
      {
        role: "user",
        content: `You are given a university past exam paper for the course: "${courseTopic}".

Extract ALL questions from this exam as a JSON array. Preserve the exact question wording from the paper.

Exam Paper Text:
${truncatedText}

Return ONLY a JSON array (no markdown around the array, no explanation). Each element MUST have this shape:
{
  "type": "mcq" | "open",
  "content": "The question stem (for MCQ: stem only, WITHOUT the answer options)",
  "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"],
  "correct_answer": "A. First option",
  "model_answer": "A comprehensive explanation (3-8 sentences)",
  "marks": 10,
  "key_topics": ["topic1", "topic2"]
}

MCQ DETECTION — set type "mcq" when:
- The question is followed by enumerated answer choices with any of these markers:
  • Latin letters:   A. / B. / C. / D.  (or A) / B) etc.)
  • Hebrew letters:  א. / ב. / ג. / ד.
  • Greek letters:   α. / β. / γ. / δ.
  • Numbers:         1. / 2. / 3. / 4.
  • Or ANY clearly enumerated fixed list of choices where the student picks one.
- Wording like "which of the following", "select the correct", "mark the correct answer" also signals MCQ.

When type is "mcq":
- "content": include the question STEM only — strip the options out of the content field.
- "options": array of EXACTLY the answer choices, normalized to A./B./C./D. letter prefixes regardless of the original markers (Hebrew א→A, ב→B, ג→C, ד→D; numbers 1→A, 2→B etc.). Each option string MUST start with "A. " / "B. " / "C. " / "D. " followed by the option text.
- "correct_answer": your best-guess correct answer based on your knowledge of the course material. It MUST be the EXACT full string of the chosen option (e.g. "B. The mutex is released before the thread exits"). If the exam paper marks the correct answer explicitly, use that. Otherwise use your domain knowledge — accuracy depends on Claude's familiarity with the material.
- "model_answer": explain WHY the correct option is right and briefly why the distractors are wrong. This becomes the explanation shown to students after they answer. Write in the SAME language as the exam.
- Omit "options" and "correct_answer" keys for open questions (or set them to null).

OPEN QUESTION — set type "open" when ANY of the following apply
(these checks OVERRIDE any visual list-like formatting that might come after):

1. The question explicitly asks the student to **explain, justify, derive, prove,
   describe, compare, contrast, discuss, calculate, show that, why, or how**.
   In Hebrew, the equivalent markers are STRICT open-question signals:
     • הסבר          (explain)
     • הסבירו        (explain, imperative plural)
     • תאר / תארו    (describe)
     • הוכח / הוכיחו (prove)
     • הראה / הראו   (show)
     • חשב / חשבו    (calculate)
     • השווה / השוו  (compare)
     • דון / דונו    (discuss)
     • נמק / נמקו    (justify)
     • מדוע          (why)
     • כיצד          (how)
     • ?…מה קורה אם  (what happens if…?)
   If the question or any part of it contains any of these words AND requests
   reasoning, it is OPEN — even if the source paper visually formats some
   answer hints below.

2. **Yes/no questions that ALSO request an explanation** are OPEN, not MCQ.
   Examples that LOOK like MCQ but are OPEN:
     • "Does X cause deadlock? Explain."     → OPEN
     • "האם האלגוריתם נכון? הסבר."            → OPEN
     • "Can you simplify the code? Why or why not?" → OPEN
   The "yes/no" framing is a misleading cue — what matters is whether the
   student must produce written reasoning, which makes it open.

3. The expected answer is a piece of code, a derivation, a diagram, a proof,
   a number-with-working, or a multi-sentence written response.

4. No enumerated choice list (A./B./C./D., א./ב./ג./ד., 1./2./3./4., etc.) is
   genuinely presented as the exhaustive set the student must pick one from.
   A list of *examples* or *hints* below an open question is NOT a choice list.

For open questions:
- "options" and "correct_answer" MUST be omitted (or null).
- "model_answer" should be a multi-sentence written answer covering the key
  points a student must address.

When in doubt between MCQ and OPEN, **prefer OPEN**. A misclassified open
question rendered as MCQ ruins the exam; a misclassified MCQ rendered as open
just lets the student type the option letter.

SUB-PARTS: If a parent question has sub-parts (a / b / c), treat each sub-part as its own element in the array. Each sub-part inherits the parent question context in its "content" field. Detect each sub-part's type independently — a parent question can have some MCQ sub-parts and some open sub-parts.

GENERAL RULES:
- Preserve the EXACT original wording — do not rephrase
- marks: use the marks shown in the exam, or estimate 5-20 based on complexity
- key_topics: 1-4 specific topic names from the course that the question tests
- IMPORTANT: All prose text (content, model_answer, options) MUST be in the SAME LANGUAGE as the source exam. If the exam is in Hebrew, write those fields in Hebrew (except keep code/identifiers in Latin script).

FORMATTING RULES (exam questions often contain pseudocode, formulas, or tables):
- Format the "content" and "model_answer" fields as **Markdown**.
- Wrap any pseudocode block in a fenced code block (\`\`\`...\`\`\`) with real line breaks and indentation.
- Wrap single identifiers / function calls in single backticks: \`mutex\`, \`lock(m)\`, \`O(n log n)\`.
- For tabular data, use GFM Markdown table syntax with pipes and dashes — never use whitespace-aligned text.
- Keep code in its source language (Latin script) even when the surrounding prose is Hebrew.
- Use \\n for line breaks inside JSON string values. Backticks and code fences must appear literally inside the JSON strings.
- MCQ option strings should be plain text (no markdown) — they are short choice labels.

MATH / LOGIC / FORMAL NOTATION (CRITICAL — applies to CS, math, and formal-methods exams):
- The downstream renderer supports KaTeX. Wrap inline math in \`$...$\` and display math in \`$$...$$\` (using ACTUAL dollar signs, written into the JSON string).
- Examples of content you MUST preserve in LaTeX (not drop, not paraphrase, not "see original"):
  - Set-builder notation: \`$\\{w \\in \\{0,1\\}^* \\mid |w| \\text{ is a multiple of } 3\\}$\`
  - Quantifiers / logic: \`$\\forall x \\in S, \\exists y$\`
  - Greek letters: \`$\\Sigma\`, \`$\\delta$\`, \`$\\epsilon$\`, \`$\\lambda$\`
  - Kleene star and operators: \`$L^*$\`, \`$\\cup$\`, \`$\\cap$\`, \`$\\to$\`, \`$\\Rightarrow$\`
  - Subscripts / superscripts: \`$q_0$\`, \`$2^n$\`, \`$\\Sigma^*$\`
  - Cardinality bars: \`$|w|$\`
- NEVER write a placeholder like "(see original questionnaire)" or "(specify the exact language)" — the question content MUST be self-contained. If the source PDF defined a language B with set notation, the extracted question MUST include the full LaTeX-wrapped definition of B inline.
- If the PDF text contains unicode math symbols (\\u2208 ∈, \\u2227 ∧, \\u2200 ∀, etc.), TRANSLATE them to LaTeX (\`\\in\`, \`\\wedge\`, \`\\forall\`) wrapped in dollar signs.
- For complex multi-line definitions or proofs, use display math with \`$$...$$\` on its own line.
- This rule overrides any tendency to simplify or summarize: the student needs the EXACT math content, not a description of it.

Return ONLY valid JSON array — no prose around it, no markdown fence around the array itself.`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const raw = content.text.trim();
  console.log(
    `[extract-exam] Claude returned ${raw.length} chars. Head: ${JSON.stringify(raw.slice(0, 240))} ... Tail: ${JSON.stringify(raw.slice(-200))}`
  );
  const parsed = parseExamQuestionsJson(raw);
  console.log(`[extract-exam] parsed ${parsed.length} questions`);
  return parsed;
}

/**
 * Defensive parser. The same approach we use for boss-question generation:
 *  1. Direct JSON.parse.
 *  2. Strip markdown code fences and retry.
 *  3. Bracket-slice the first array and retry.
 *  4. Repair mode: scan the array body character-by-character (with string +
 *     escape awareness) and recover every complete top-level object, dropping
 *     a partial trailing one. This saves us when the response is truncated
 *     mid-question on a long Hebrew exam.
 */
function parseExamQuestionsJson(raw: string): ExtractedExamQuestion[] {
  // 1. Direct
  try {
    const arr = JSON.parse(raw) as ExtractedExamQuestion[];
    if (Array.isArray(arr) && arr.length > 0) return arr;
    // Empty array from a direct parse is suspicious — fall through to repair
    // mode to scan for objects that may have been written outside the array.
  } catch {}

  // 2. Strip markdown fences
  const fenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (fenced !== raw) {
    try {
      const arr = JSON.parse(fenced) as ExtractedExamQuestion[];
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch {}
  }

  // 3. Bracket-slice. Bracket matching can pick up a stray `[]` in prose
  // (e.g. "The empty set []") — if that happens we'd silently return zero
  // questions. Guard against this: ONLY accept this stage if it yields a
  // non-empty array. Otherwise fall through to repair mode which scans the
  // entire response for valid object literals regardless of bracket noise.
  const startIdx = fenced.indexOf("[");
  const endIdx = fenced.lastIndexOf("]");
  if (startIdx === -1) {
    throw new Error("Could not extract JSON array from exam-questions response");
  }
  if (endIdx > startIdx) {
    try {
      const arr = JSON.parse(fenced.slice(startIdx, endIdx + 1)) as ExtractedExamQuestion[];
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch {}
  }

  // 4. Repair: scan the ENTIRE response for fully-formed top-level objects
  // (not just inside the bracketed range, in case Claude wrote them outside
  // a proper array wrapper or the array got misframed). This is the most
  // robust recovery path.
  const body = fenced;
  const objects: ExtractedExamQuestion[] = [];
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
          objects.push(JSON.parse(candidate) as ExtractedExamQuestion);
        } catch {
          // Skip malformed individual object — keep going.
        }
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) {
      break;
    }
  }

  if (objects.length === 0) {
    throw new Error(
      "Could not extract any complete exam-question objects from response (response may have been truncated)"
    );
  }

  return objects;
}
