import Anthropic from "@anthropic-ai/sdk";
import type { OutputLanguage } from "./extract-course";

export interface EpisodeTopicStructure {
  title: string;
  summary: string;
  key_concepts: string[];
  difficulty: number;
  prerequisite: string | null;
  page_start: number | null;
  page_end: number | null;
}

export interface EpisodeStructure {
  episode_title: string;
  description: string;
  topics: EpisodeTopicStructure[];
}

/**
 * Builds the language-rule paragraph injected into the prompt. Mirrors
 * extract-course.ts but tuned for per-episode output.
 */
function buildLanguageRule(lang: OutputLanguage): string {
  if (lang === "en") {
    return "- CRITICAL LANGUAGE RULE: Write ALL output text (episode_title, description, topic titles, summaries, key_concepts) in ENGLISH, EVEN IF the PDF is in a different language. The student wants the course content in English. This overrides any other language instruction.";
  }
  if (lang === "he") {
    return "- CRITICAL LANGUAGE RULE: Write ALL output text (episode_title, description, topic titles, summaries, key_concepts) in HEBREW, EVEN IF the PDF is in a different language. The student wants the course content in Hebrew. This overrides any other language instruction.";
  }
  return "- IMPORTANT: All text content MUST be in the SAME LANGUAGE as the source material. If the PDF is in Hebrew, write everything in Hebrew. If in English, write in English.";
}

/**
 * Extract a SINGLE episode's structure from one or more PDF buffers.
 *
 * This is the per-episode counterpart to extractCourseStructure: instead of
 * trying to identify multiple chapters across a 300-page textbook, this
 * function assumes the input PDFs cover ONE chapter / one episode and just
 * extracts its topics, key concepts, and page ranges. Output is far more
 * reliable than the whole-textbook approach.
 *
 * Up to 3 PDFs supported per episode (lecture + notes + slides, etc.) —
 * each must be under Anthropic's 32 MB / 100 page document limit.
 *
 * @param userProvidedTitle If the user typed a title in the upload form,
 *   pass it here and we'll use it verbatim. Otherwise Claude infers from
 *   the PDF headings (e.g. "Chapter 1: Finite Automata").
 */
export async function extractEpisodeStructure(
  pdfBuffers: Array<{ name: string; buffer: Buffer }>,
  options: {
    outputLanguage?: OutputLanguage;
    userProvidedTitle?: string;
    /** Total physical pages of the PRIMARY PDF (the one whose pages will
     *  be displayed in the topic viewer). Used to (a) ground the prompt
     *  so Claude doesn't use the textbook's printed page numbers, and
     *  (b) clip any out-of-range output. */
    primaryFilePageCount?: number;
  } = {}
): Promise<EpisodeStructure> {
  if (pdfBuffers.length === 0) {
    throw new Error("extractEpisodeStructure called with no PDFs");
  }
  if (pdfBuffers.length > 3) {
    throw new Error(
      `extractEpisodeStructure supports up to 3 PDFs per episode (got ${pdfBuffers.length}). Split into separate episodes if you have more material.`
    );
  }

  if (!process.env.CLAUDE_API_KEY) {
    throw new Error(
      "CLAUDE_API_KEY is not set. Add it to your Vercel project environment variables and redeploy."
    );
  }

  for (const { name, buffer } of pdfBuffers) {
    if (buffer.length > 32 * 1024 * 1024) {
      throw new Error(
        `PDF "${name}" is larger than 32 MB — split it into smaller files.`
      );
    }
  }

  const outputLanguage = options.outputLanguage ?? "auto";
  const userTitle = options.userProvidedTitle?.trim() || "";
  const primaryPageCount = options.primaryFilePageCount ?? 0;
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  // Document blocks first, then the instruction text block.
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

  const titleInstruction = userTitle
    ? `The user has provided an explicit episode title: "${userTitle}". Use it EXACTLY as the episode_title in your output — do NOT change, translate, or paraphrase it. Generate a short description based on the actual content.`
    : `Infer the episode_title from the document — typically the chapter title or top-level section heading (e.g. "Chapter 1: Finite Automata", "Regular Languages", etc.). Use the source PDF's wording, translated according to the language rule below.`;

  contentBlocks.push({
    type: "text",
    text: `You are an expert academic curriculum designer. The attached PDF${pdfBuffers.length > 1 ? "s cover" : " covers"} a SINGLE chapter / episode of a course. Extract the structure as JSON.

Your task is per-episode, not per-course: do NOT try to split the content into multiple episodes. Treat all the attached PDFs as one cohesive episode's worth of material.

## Episode title

${titleInstruction}

## Topics inside this episode

Topics = the major numbered sections within this chapter (e.g. 1.1, 1.2, 1.3 if the chapter is "Chapter 1"). Rules:
- Each major numbered section (1.1, 1.2, 1.3, ...) becomes ONE topic.
- **CRITICAL — topic title MUST start with the section number** as it appears in the source PDF, followed by the section name. Examples:
    * "1.1 Finite Automata" (English source) → topic title: "1.1 Finite Automata"
    * "1.1 אוטומטים סופיים" (Hebrew source) → topic title: "1.1 אוטומטים סופיים"
    * "1.1 Finite Automata" but output language is Hebrew → topic title: "1.1 אוטומטים סופיים" (keep the "1.1" prefix; translate only the section name)
  The number prefix is REQUIRED. Students rely on these numbers to navigate the PDF.
- A topic INCLUDES all of its sub-sections. Section 1.3 with sub-sections 1.3.1, 1.3.2, 1.3.3 is ONE single topic, NOT four separate topics.
- NEVER create a topic for a sub-section like 1.3.1 — it's part of its parent.
- If the source PDF uses a different numbering scheme (e.g. "1.A", "I.", "§ 1"), preserve that scheme as it appears in the PDF.
- If a section truly has no number in the source (just a heading), use the heading verbatim (translated if needed) without inventing a number.
- Skip summary/review/glossary/exercise sections at the end of the chapter — don't create topics for those.
- Aim for 3-7 topics per episode. If there are many sections, group closely related ones together.

## Page ranges — CRITICAL: read this carefully

For each topic, set page_start and page_end using the **1-based PDF page index** — that is, the Nth physical page of the attached PDF, counting from 1.

**ABSOLUTELY DO NOT** use the printed page numbers shown in the textbook's headers or footers. The attached PDF is often a chapter excerpt extracted from a larger book; the textbook header may say "Chapter 1 begins on page 31" but if Chapter 1 begins on the **1st** physical page of THIS attached PDF, then page_start MUST be 1, not 31.

How to count:
- The very first page of the attached PDF is page 1 (regardless of what the printed page number says).
- The second physical page is page 2. And so on.
- ${primaryPageCount > 0
  ? `The primary attached PDF has ${primaryPageCount} pages total. All page_start and page_end values MUST be integers between 1 and ${primaryPageCount} inclusive. Any value above ${primaryPageCount} is WRONG and will be rejected.`
  : `Use sensible values within the actual page count of the attached PDF.`}

For each topic:
- page_start = the index of the first physical page of the topic's section.
- page_end = the index of the last physical page of the topic's section (the page just before the next major section begins).
- If section 1.3 contains sub-sections 1.3.1, 1.3.2, etc., page_end must include ALL of 1.3.x's pages, not just the intro.
- If a section spans only one page, page_start === page_end is fine.

Worked example: imagine an attached PDF with 52 physical pages whose first physical page shows "Chapter 1: Regular Languages" in big text (even though the printed footer says "31"). Inside, you find:
  - "1.1 Finite Automata" starting on physical page 3
  - "1.2 Nondeterminism" starting on physical page 17
  - "1.3 Regular Expressions" starting on physical page 30
  - "1.4 Nonregular Languages" starting on physical page 41
  - Chapter ends on physical page 52
Then the correct output is:
  - Topic "1.1 Finite Automata": page_start=3, page_end=16
  - Topic "1.2 Nondeterminism": page_start=17, page_end=29
  - Topic "1.3 Regular Expressions": page_start=30, page_end=40
  - Topic "1.4 Nonregular Languages": page_start=41, page_end=52
The fact that the textbook footer says page "63" or "75" for "1.3" is IRRELEVANT — we want physical PDF indices.

## JSON structure to return

Return ONLY this JSON (no markdown, no explanation, no code blocks):

{
  "episode_title": "The chapter title",
  "description": "A 2-3 sentence overview of what this episode covers",
  "topics": [
    {
      "title": "Topic title (typically the section heading)",
      "summary": "A 3-5 sentence summary explaining what this topic covers, what concepts it introduces, and why it matters",
      "key_concepts": ["Concept 1", "Concept 2", "Concept 3", "..."],
      "difficulty": 3,
      "prerequisite": null,
      "page_start": 5,
      "page_end": 12
    }
  ]
}

### Rules

- difficulty is 1-5 (1 = introductory, 5 = advanced proofs/algorithms)
- prerequisite is null OR the EXACT title of a previous topic in this same episode that should be understood first
- key_concepts: 4-8 specific terms, theorems, or ideas from the section
- Topics MUST appear in the same order as in the document
${buildLanguageRule(outputLanguage)}
- Return ONLY valid JSON, no markdown code blocks or extra text`,
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

  const raw = content.text.trim();
  const parsed = parseEpisodeStructure(raw, userTitle);

  // Safety net: clamp any out-of-range page indices. Defensive against
  // Claude occasionally still using printed page numbers despite the prompt.
  if (primaryPageCount > 0) {
    for (const topic of parsed.topics) {
      if (topic.page_start != null) {
        if (topic.page_start < 1) topic.page_start = 1;
        if (topic.page_start > primaryPageCount) topic.page_start = primaryPageCount;
      }
      if (topic.page_end != null) {
        if (topic.page_end < 1) topic.page_end = 1;
        if (topic.page_end > primaryPageCount) topic.page_end = primaryPageCount;
      }
      // Ensure end >= start
      if (
        topic.page_start != null &&
        topic.page_end != null &&
        topic.page_end < topic.page_start
      ) {
        topic.page_end = topic.page_start;
      }
    }
  }

  return parsed;
}

// ─── Defensive JSON parser ────────────────────────────────────────────────────
// Mirrors the 6-stage parser in extract-course.ts — Claude can produce small
// JSON malformations (smart quotes, raw newlines, missing commas), and these
// stages recover from each common failure mode before giving up.

function parseEpisodeStructure(raw: string, userProvidedTitle: string): EpisodeStructure {
  const tryParse = (text: string): EpisodeStructure | null => {
    try {
      const result = JSON.parse(text) as EpisodeStructure;
      // If user supplied a title, honor it even if Claude ignored the instruction.
      if (userProvidedTitle) result.episode_title = userProvidedTitle;
      return result;
    } catch {
      return null;
    }
  };

  // Stage 1
  let result = tryParse(raw);
  if (result) return result;

  // Stage 2 — strip Markdown fences
  let cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  result = tryParse(cleaned);
  if (result) return result;

  // Stage 3 — bracket-slice
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    result = tryParse(cleaned);
    if (result) return result;
  }

  // Stage 4 — smart quotes + trailing commas
  let repaired = cleaned
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
  result = tryParse(repaired);
  if (result) return result;

  // Stage 5 — escape raw control chars inside strings
  repaired = escapeControlCharsInStrings(repaired);
  result = tryParse(repaired);
  if (result) return result;

  // Stage 6 — insert missing commas between adjacent values
  repaired = insertMissingCommas(repaired);
  result = tryParse(repaired);
  if (result) return result;

  // Out of options — surface useful context for debugging.
  const preview = raw.slice(0, 400).replace(/\s+/g, " ");
  throw new Error(
    `Could not parse episode JSON after 6 repair stages. First 400 chars: ${preview}...`
  );
}

function escapeControlCharsInStrings(input: string): string {
  let out = "";
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escapeNext) { out += c; escapeNext = false; continue; }
    if (c === "\\") { out += c; escapeNext = true; continue; }
    if (c === '"') { inString = !inString; out += c; continue; }
    if (inString) {
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
    }
    out += c;
  }
  return out;
}

function insertMissingCommas(input: string): string {
  let out = "";
  let inString = false;
  let escapeNext = false;
  let lastNonWs = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escapeNext) { out += c; escapeNext = false; continue; }
    if (c === "\\" && inString) { out += c; escapeNext = true; continue; }
    if (c === '"') {
      if (inString) { out += c; lastNonWs = '"'; inString = false; }
      else {
        if (lastNonWs === '"' || lastNonWs === "]" || lastNonWs === "}") out += ",";
        out += c; lastNonWs = '"'; inString = true;
      }
      continue;
    }
    if (inString) { out += c; continue; }
    if (c === "[" || c === "{") {
      if (lastNonWs === '"' || lastNonWs === "]" || lastNonWs === "}") out += ",";
      out += c; lastNonWs = c; continue;
    }
    if (c === "]" || c === "}") { out += c; lastNonWs = c; continue; }
    if (/\s/.test(c)) { out += c; continue; }
    out += c; lastNonWs = c;
  }
  return out;
}
