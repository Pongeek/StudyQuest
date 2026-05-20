import Anthropic from "@anthropic-ai/sdk";

export interface TopicStructure {
  title: string;
  summary: string;
  key_concepts: string[];
  difficulty: number;
  prerequisite: string | null;
  page_start: number | null;
  page_end: number | null;
}

export interface EpisodeStructure {
  title: string;
  description: string;
  topics: TopicStructure[];
}

export interface CourseStructure {
  theme_name: string;
  subject: string;
  episodes: EpisodeStructure[];
}

export type OutputLanguage = "auto" | "en" | "he";

/**
 * Builds the language-rule paragraph injected into the prompt. When 'auto',
 * we keep the existing behavior of mirroring the source material's language.
 * When 'en' or 'he', we explicitly tell the model to override the source
 * language and emit everything in the chosen language.
 */
function buildLanguageRule(lang: OutputLanguage): string {
  if (lang === "en") {
    return "- CRITICAL LANGUAGE RULE: Write ALL output text (theme_name, subject, titles, descriptions, summaries, key_concepts) in ENGLISH, EVEN IF the source material is in a different language. The student wants the course content in English regardless of the PDF's language. This overrides any other language instruction.";
  }
  if (lang === "he") {
    return "- CRITICAL LANGUAGE RULE: Write ALL output text (theme_name, subject, titles, descriptions, summaries, key_concepts) in HEBREW, EVEN IF the source material is in a different language. The student wants the course content in Hebrew regardless of the PDF's language. This overrides any other language instruction.";
  }
  // auto
  return "- IMPORTANT: All text content (theme_name, subject, titles, descriptions, summaries, key_concepts) MUST be in the SAME LANGUAGE as the source material. If the material is in Hebrew, write everything in Hebrew. If in English, write in English.";
}

/**
 * Extract course structure directly from PDF buffer(s) using Claude's native
 * vision-based PDF reading. Bypasses unpdf entirely — Claude sees the actual
 * rendered pages, so math notation, diagrams, set-builder syntax, automata,
 * and other non-text content all survive. Page numbers come through
 * naturally (Claude sees page headers/footers in the PDF).
 *
 * Pass an array so the caller can include multiple PDFs (lecture + notes)
 * in a single extraction call. Each PDF must fit within Anthropic's 32 MB
 * per-document limit; total content stays within Claude's 200k context.
 */
export async function extractCourseStructure(
  pdfBuffers: Array<{ name: string; buffer: Buffer }>,
  outputLanguage: OutputLanguage = "auto"
): Promise<CourseStructure> {
  if (pdfBuffers.length === 0) {
    throw new Error("extractCourseStructure called with no PDFs");
  }
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  // Validate each PDF is under Anthropic's 32 MB / 100 page document limit.
  // Anything larger needs to be split client-side first.
  for (const { name, buffer } of pdfBuffers) {
    if (buffer.length > 32 * 1024 * 1024) {
      throw new Error(
        `PDF "${name}" is larger than 32 MB — Claude can only read PDFs up to that size in a single request.`
      );
    }
  }

  // Use the first PDF's name as the canonical "fileName" for the prompt.
  // When multiple PDFs are present, Claude still gets to see all of them.
  const fileName = pdfBuffers[0].name;

  // Build the message content: each PDF attached as its own document block,
  // followed by the instruction text block. Claude reads the PDFs natively
  // and uses page numbers visible in the PDF itself.
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const { buffer } of pdfBuffers) {
    contentBlocks.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: buffer.toString("base64"),
      },
    });
  }
  contentBlocks.push({
    type: "text",
    text: `You are an expert academic curriculum designer. Your job is to analyze the attached PDF study material and create a structured course outline that maps cleanly to the document's own section numbering.

The PDF${pdfBuffers.length > 1 ? "s are" : " is"} attached above. Read ${pdfBuffers.length > 1 ? "them" : "it"} directly — you have access to the actual rendered pages, including math notation, diagrams, tables, and page numbers visible in the document.

Primary file: ${fileName}

## Your task

Return a JSON object that organizes this material into **episodes** and **topics**.

### How to decide what is an "episode" vs a "topic"

CRITICAL — follow these rules exactly:

1. **Look at the section numbering in the document** (e.g., 6.1, 6.2, 6.3, or Chapter 1, Chapter 2, etc.).

2. **Episodes = the highest-level grouping in the document.**
   - If the document is a single chapter (e.g., "Chapter 6: Deadlock"), create ONE episode for the entire chapter.
   - If the document contains multiple chapters, each chapter becomes one episode.
   - If there are no chapters but clear major parts, each part is an episode.

3. **Topics = the major numbered sections within each episode.**
   - For a chapter with sections 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 → each section (6.1, 6.2, etc.) becomes ONE topic.
   - A topic MUST include ALL of its sub-sections. Section 6.1 with sub-sections 6.1.1 and 6.1.2 is ONE single topic, NOT three separate topics.
   - NEVER create a topic for a sub-section (like 6.1.1 or 6.3.2). Sub-sections are part of their parent topic.
   - The key_concepts field should list the important sub-topics and terms covered within that section.

4. **Page ranges MUST cover the ENTIRE section, including ALL sub-sections.**
   - page_start = the page N where the section heading first appears.
   - page_end = the LAST page N before the NEXT major section begins.
   - **CRITICAL:** If section 1.3 contains sub-sections 1.3.1, 1.3.2, 1.3.3 — all of those sub-section pages belong INSIDE topic 1.3. page_end must reach the page just before section 1.4 starts, not the end of the 1.3 intro paragraph.
   - Example: if section 1.3 starts on [PAGE 33] and section 1.4 starts on [PAGE 50], then 1.3 has page_start=33, page_end=49. Even if pages 37-49 are sub-sections 1.3.1, 1.3.2, etc., they all belong to topic 1.3.
   - Before finalizing a topic's page_end, look ahead in the document for sub-section headings (e.g., 1.3.1) — those pages MUST be included in the parent topic's range.
   - If you cannot find the next major section heading, set page_end to the last page where related content appears.
   - NEVER give a topic only 1-2 pages if the section clearly continues with sub-sections or more content.

5. **Summary sections, exercise sections, and glossary sections** (like "סיכום", "שאלות לחזרה", "בעיות פתורות", "רשימת מושגים", "Summary", "Review Questions") should NOT be created as topics. Skip them entirely.

### JSON structure to return

Return ONLY this JSON (no markdown, no explanation, no code blocks):

{
  "theme_name": "A creative RPG-style adventure name for this course (e.g., 'The Deadlock Dungeon', 'The Memory Labyrinth')",
  "subject": "The academic subject area (e.g., 'Operating Systems')",
  "episodes": [
    {
      "title": "Chapter/unit title",
      "description": "2-3 sentence overview of what this chapter covers",
      "topics": [
        {
          "title": "Section title as it appears in the document (e.g., '6.1 משאבים')",
          "summary": "3-4 sentence summary covering ALL sub-sections within this section. Be thorough — this summary should capture the key ideas from every sub-section.",
          "key_concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
          "difficulty": 3,
          "prerequisite": null,
          "page_start": 3,
          "page_end": 5
        }
      ]
    }
  ]
}

### Rules

- difficulty is 1-5 (1=introductory concepts, 5=complex algorithms or proofs)
- prerequisite is null OR the exact title of a previous topic in the same episode that should be understood first
- key_concepts should list 4-8 specific terms, algorithms, or ideas from the section (include sub-section topics as concepts)
- Topics should appear in the same order as in the document
${buildLanguageRule(outputLanguage)}
- Return ONLY valid JSON, absolutely no markdown code blocks or extra text

### Common mistakes to AVOID

- DO NOT split sub-sections (6.1.1, 6.1.2) into separate topics. They belong together under their parent section (6.1).
- DO NOT create topics with only 1 page when the section clearly spans 2-4 pages.
- DO NOT create topics for summary/review/glossary sections at the end of a chapter.
- DO NOT create more than 8 topics per episode. If there are many sections, group closely related ones together.`,
  });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: contentBlocks,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  // 4-stage defensive JSON parser. Mirrors the approach used by the exam
  // extractor (see CLAUDE.md). Claude usually returns valid JSON, but with
  // non-Latin output (Hebrew, Arabic) or longer responses the model
  // occasionally adds code fences, prose, smart quotes, or stray trailing
  // commas. Each stage handles one common failure mode before re-trying.
  const raw = content.text.trim();
  return parseCourseStructure(raw);
}

function parseCourseStructure(raw: string): CourseStructure {
  // Stage 1 — direct parse
  try {
    return JSON.parse(raw) as CourseStructure;
  } catch { /* fall through */ }

  // Stage 2 — strip Markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as CourseStructure;
  } catch { /* fall through */ }

  // Stage 3 — bracket-slice: take everything between the FIRST `{` and the
  // LAST `}`. Drops any pre/post prose the model may have added.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(cleaned) as CourseStructure;
    } catch { /* fall through */ }
  }

  // Stage 4 — repair common malformations (smart quotes, trailing commas)
  let repaired = cleaned
    .replace(/[“”„]/g, '"')  // “ ” „ → "
    .replace(/[‘’‚]/g, "'")  // ‘ ’ ‚ → '
    .replace(/,\s*([}\]])/g, "$1");          // trailing commas

  try {
    return JSON.parse(repaired) as CourseStructure;
  } catch { /* fall through */ }

  // Stage 5 — escape raw newlines / tabs / CR that Claude sometimes leaves
  // UNESCAPED inside string values (JSON forbids these). Tiny state machine
  // tracks whether we're inside a JSON string literal.
  repaired = escapeControlCharsInStrings(repaired);

  try {
    return JSON.parse(repaired) as CourseStructure;
  } catch { /* fall through */ }

  // Stage 6 — insert missing commas between adjacent JSON values. Claude
  // occasionally forgets the comma between `"options": [...]` and the next
  // property in long responses. See insertMissingCommas() for the rules.
  repaired = insertMissingCommas(repaired);

  try {
    return JSON.parse(repaired) as CourseStructure;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const posMatch = errMsg.match(/position (\d+)/);
    const pos = posMatch ? parseInt(posMatch[1], 10) : 0;
    const context = repaired
      .slice(Math.max(0, pos - 120), pos + 120)
      .replace(/\s+/g, " ");
    const preview = raw.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `Could not parse Claude response as JSON after 6 repair stages. ` +
      `Failure at char ${pos}. ` +
      `Context (±120 chars around failure): ${JSON.stringify(context)}. ` +
      `Head of raw response: ${preview}... ` +
      `(original error: ${errMsg})`
    );
  }
}

/**
 * Insert commas between adjacent JSON values where Claude forgot them.
 * See generate-questions.ts for the full doc-comment.
 */
function insertMissingCommas(input: string): string {
  let out = "";
  let inString = false;
  let escapeNext = false;
  let lastNonWs = "";

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
        out += c;
        lastNonWs = '"';
        inString = false;
      } else {
        if (lastNonWs === '"' || lastNonWs === "]" || lastNonWs === "}") {
          out += ",";
        }
        out += c;
        lastNonWs = '"';
        inString = true;
      }
      continue;
    }
    if (inString) {
      out += c;
      continue;
    }
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
      continue;
    }
    out += c;
    lastNonWs = c;
  }

  return out;
}

/**
 * Walks a JSON-ish string and escapes any raw newlines, tabs, or carriage
 * returns that appear INSIDE string literals. See generate-questions.ts
 * for the same helper applied to question arrays.
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
