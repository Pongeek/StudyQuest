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
- A topic INCLUDES all of its sub-sections. Section 1.3 with sub-sections 1.3.1, 1.3.2, 1.3.3 is ONE single topic, NOT four separate topics.
- NEVER create a topic for a sub-section like 1.3.1 — it's part of its parent.
- Skip summary/review/glossary/exercise sections at the end of the chapter — don't create topics for those.
- Aim for 3-7 topics per episode. If there are many sections, group closely related ones together.

## Page ranges

For each topic, set page_start and page_end:
- page_start = the page where the topic's section heading first appears.
- page_end = the last page before the NEXT major section begins.
- CRITICAL: If section 1.3 contains sub-sections 1.3.1, 1.3.2, etc., the page_end of topic 1.3 must reach the end of 1.3.x's content — NOT just the intro paragraph of 1.3.
- Use page numbers visible in the PDF (headers, footers, or numbered pages). The PDFs are attached above — read them directly.

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
  return parseEpisodeStructure(raw, userTitle);
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
