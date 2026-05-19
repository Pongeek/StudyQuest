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

export async function extractCourseStructure(
  pdfText: string,
  fileName: string
): Promise<CourseStructure> {
  const truncatedText = pdfText.slice(0, 80000);
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are an expert academic curriculum designer. Your job is to analyze study material and create a structured course outline that maps cleanly to the document's own section numbering.

The text below has [PAGE N] markers showing which PDF page each section of text comes from. You MUST use these markers to determine accurate page ranges.

File: ${fileName}

Study Material:
${truncatedText}

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

4. **Page ranges MUST cover the ENTIRE section.**
   - page_start = the [PAGE N] where the section heading first appears.
   - page_end = the LAST [PAGE N] before the NEXT major section begins.
   - Example: if section 6.1 starts on [PAGE 3] and section 6.2 starts on [PAGE 5], then 6.1 has page_start=3, page_end=4 (it covers pages 3 AND 4 completely).
   - The page_end of one topic should be the page just before the page_start of the next topic (or overlap by 1 page if the next section starts mid-page).
   - NEVER give a topic only 1 page if the section clearly spans multiple pages.

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
- IMPORTANT: All text content (theme_name, subject, titles, descriptions, summaries, key_concepts) MUST be in the SAME LANGUAGE as the source material. If the material is in Hebrew, write everything in Hebrew. If in English, write in English.
- Return ONLY valid JSON, absolutely no markdown code blocks or extra text

### Common mistakes to AVOID

- DO NOT split sub-sections (6.1.1, 6.1.2) into separate topics. They belong together under their parent section (6.1).
- DO NOT create topics with only 1 page when the section clearly spans 2-4 pages.
- DO NOT create topics for summary/review/glossary sections at the end of a chapter.
- DO NOT create more than 8 topics per episode. If there are many sections, group closely related ones together.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const jsonText = content.text.trim();
  try {
    return JSON.parse(jsonText) as CourseStructure;
  } catch {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not extract JSON from Claude response");
    return JSON.parse(match[0]) as CourseStructure;
  }
}
