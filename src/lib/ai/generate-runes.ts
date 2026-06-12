// Per-topic Rune Deck generator (Anki-style flashcards).
//
// Produces 8–12 ATOMIC recall cards (front/back) for a topic: definitions,
// theorem statements, notation, sharp distinctions. NOT quiz questions —
// each card tests ONE retrievable fact and is answerable in seconds.
//
// Tool-use for schema-enforced output, streaming for Hebrew+LaTeX headroom
// (mirrors regenerate-question.ts). Cost: ~$0.03–0.06 / forge at Sonnet 4.6;
// cards are cached in rune_cards until the deck is reforged, and reps are
// self-graded — zero AI cost per drill.

import Anthropic from "@anthropic-ai/sdk";
import { COACH_PERSONA_SYSTEM } from "@/lib/ai/coach-persona";
import type { OutputLanguage } from "@/lib/ai/generate-questions";

/** Deck-size bounds — prompt guidance + server-side clamp. */
export const RUNE_MIN_CARDS = 8;
export const RUNE_MAX_CARDS = 12;

export interface GeneratedRuneCard {
  front: string;
  back: string;
}

export interface RuneDeckReply {
  cards: GeneratedRuneCard[];
  outputTokens: number;
  stopReason: string;
}

function buildLanguageRule(lang: OutputLanguage): string {
  if (lang === "en") {
    return "- CRITICAL LANGUAGE RULE: Write ALL card text (fronts and backs) in ENGLISH. This overrides any other language signal.";
  }
  if (lang === "he") {
    return "- CRITICAL LANGUAGE RULE: Write ALL card text (fronts and backs) in HEBREW. This overrides any other language signal.";
  }
  return "- IMPORTANT: All card text MUST be in the SAME LANGUAGE as the topic summary.";
}

export async function generateRunes(params: {
  topicTitle: string;
  topicSummary: string;
  keyConcepts: string[];
  episodeTitle: string;
  courseSubject: string;
  /** Optional source PDF excerpt, same convention as the cheat sheet. */
  sourceExcerpt?: string | null;
  outputLanguage?: OutputLanguage;
}): Promise<RuneDeckReply> {
  const {
    topicTitle,
    topicSummary,
    keyConcepts,
    episodeTitle,
    courseSubject,
    sourceExcerpt,
  } = params;
  const outputLanguage = params.outputLanguage ?? "auto";

  if (!process.env.CLAUDE_API_KEY) {
    throw new Error(
      "CLAUDE_API_KEY is not set. Add it to Vercel project env (Settings → Environment Variables) and redeploy."
    );
  }

  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  // Adaptive deck size: roughly one card per key concept, plus room for
  // notation/distinction cards, clamped to the 8–12 band.
  const targetCount = Math.min(
    RUNE_MAX_CARDS,
    Math.max(RUNE_MIN_CARDS, keyConcepts.length + 2),
  );

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: COACH_PERSONA_SYSTEM,
    tools: [
      {
        name: "save_rune_deck",
        description:
          "Save the topic's flashcard deck — an array of atomic front/back recall cards.",
        input_schema: {
          type: "object" as const,
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  front: {
                    type: "string",
                    description:
                      "The prompt side: a short question, term, or theorem name. ONE retrievable fact. Markdown; math per the formatting rules.",
                  },
                  back: {
                    type: "string",
                    description:
                      "The answer side: the definition, statement, or fact. Terse — 1-4 lines, no preamble. Markdown; math per the formatting rules.",
                  },
                },
                required: ["front", "back"],
              },
              description: `${RUNE_MIN_CARDS}-${RUNE_MAX_CARDS} cards covering the topic's atomic facts.`,
            },
          },
          required: ["cards"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "save_rune_deck" },
    messages: [
      {
        role: "user",
        content: `Create a flashcard deck of ${targetCount} ATOMIC recall cards for the topic below. These are spaced-repetition cards in the Anki tradition — each card is flipped and self-graded in seconds.

Course Subject: ${courseSubject}
Episode: ${episodeTitle}
Topic: ${topicTitle}
Summary: ${topicSummary}
Key Concepts: ${keyConcepts.slice(0, 14).join(", ")}
${sourceExcerpt ? `Source excerpt:\n${sourceExcerpt.slice(0, 1500)}\n` : ""}
WHAT MAKES A GOOD CARD (follow strictly):
- ATOMIC: one card = ONE fact. Never "list all properties of X" — split into one card per property worth knowing.
- ACTIVE RECALL: the front asks for retrieval ("Define ε-closure", "State the pumping lemma", "δ̂ vs δ — what's the difference?"), never recognition. No multiple choice, no yes/no.
- SHORT: front is one line; back is 1-4 lines. If the back needs a paragraph, the card is too big — split it.
- COVER: key definitions first, then theorem/lemma statements, then notation meanings, then sharp distinctions and common confusions. Skip trivia.
- SELF-CONTAINED: the front must be unambiguous without seeing the back. "What is the formula?" is a bad front; "Formula for the number of states in the product construction of two DFAs?" is a good front.
${buildLanguageRule(outputLanguage)}

FORMATTING (the renderer is KaTeX + GFM Markdown — must preserve LaTeX exactly):
- Inline math: $...$ ; display math: $$...$$ on its own line.
- Greek letters, set-builder notation, quantifiers, subscripts/superscripts in LaTeX (\\Sigma, \\delta, \\forall, q_0, 2^n, |w|, L^*, \\cup, \\in, \\to).
- Single identifiers in backticks; no fenced code blocks on cards.

HEBREW + MATH — STRICTEST RULES (apply when ANY Hebrew is in the output):

The Unicode bidirectional algorithm SCRAMBLES Hebrew lines that contain $...$ math fragments mixed with Hebrew prose. The only safe layout is: Hebrew lines are PURE Hebrew + Unicode symbols (no $). Math lives on its OWN line as $$display$$.

== ABSOLUTE BANS ==

1. NO $...$ inline math in ANY Hebrew line. NONE. Not for a single symbol, not for $R$, not for $q_0$, not for $\\varepsilon$. The $ character is FORBIDDEN on any line that contains Hebrew characters.

2. NO Hebrew characters inside ANY $$...$$ block. Use \\text{} ONLY with ASCII/English. If you need to name a set in Hebrew, do it in prose on a SEPARATE line.

3. NO mixing of Hebrew + display math + Hebrew on the same logical "line" (Markdown paragraph). Use BLANK LINES between Hebrew prose and $$display$$ blocks.

== POSITIVE RULES ==

4. Math symbols inside Hebrew prose: write as Unicode characters, NEVER LaTeX. Use:
   - ε (not $\\varepsilon$), Σ (not $\\Sigma$), δ (not $\\delta$), λ, μ, π, Φ, Δ
   - ⊆ ⊂ ∪ ∩ ∈ ∉ ∅ ∀ ∃ → ↔ ⇒ ¬ ∧ ∨
   - Subscripts via Unicode: q₀ q₁ q₂, Σ* (the star is just *), 2ⁿ
   - When subscript unicode isn't available, use the form "q_0" as PLAIN TEXT (no $) — readable as-is.

5. Latin acronyms (NFA, DFA, CFG, NDFA, PDA, CFL) in Hebrew prose stand ALONE with a space on each side. Examples:
   - CORRECT: "ה-NFA מקבל את המילה"
   - CORRECT: "ההמרה מ-NFA ל-DFA דורשת חישוב סגור-ε"
   - WRONG: "ה-$NFA$" (forbidden by rule 1)

6. When a card back needs a formula in Hebrew context, structure is ALWAYS:
   - Line A: Hebrew prose sentence ending with colon, using Unicode symbols for any inline notation.
   - Blank line.
   - Line B: $$...display math in pure LaTeX with English \\text{} only...$$

7. A card front in Hebrew follows the same rules: pure Hebrew + Unicode symbols, no $.

== EXAMPLE — CORRECT HEBREW CARD ==

front: "הגדרה: ε-סגור של קבוצת מצבים R"
back: "כל המצבים הניתנים להגעה מ-R באמצעות מעברי-ε בלבד.\\n\\n$$E(R) = \\{q \\in Q \\mid q \\text{ reachable from } R \\text{ via } \\varepsilon\\text{-transitions only}\\}$$"

== EXAMPLE — WRONG ==

WRONG (rule 1 violation — $ in Hebrew line, will scramble):
   "לכל $R \\subseteq Q$ מגדירים $E(R)$"

For English output, inline $...$ is fine in English prose. The strict rules above are ONLY for Hebrew.

CALL the save_rune_deck tool with the deck. No prose response.`,
      },
    ],
  });

  const message = await stream.finalMessage();

  console.log(
    `[generate-runes] stop_reason=${message.stop_reason}, ` +
      `output_tokens=${message.usage?.output_tokens ?? "?"}`
  );

  const toolUse = message.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error(
      `Claude did not call save_rune_deck (stop_reason=${message.stop_reason}, content types=${message.content.map((b) => b.type).join(",")})`
    );
  }

  const input = toolUse.input as { cards?: Array<Partial<GeneratedRuneCard>> };
  const rawCards = Array.isArray(input.cards) ? input.cards : [];
  const cards = rawCards
    .filter(
      (c): c is GeneratedRuneCard =>
        typeof c?.front === "string" &&
        c.front.trim().length > 0 &&
        typeof c?.back === "string" &&
        c.back.trim().length > 0,
    )
    .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
    .slice(0, RUNE_MAX_CARDS);

  if (cards.length < 4) {
    const truncatedHint =
      message.stop_reason === "max_tokens"
        ? " The response hit the max_tokens limit and was truncated — bump max_tokens in generate-runes.ts."
        : "";
    throw new Error(
      `Rune deck came back with only ${cards.length} valid cards (stop_reason=${message.stop_reason}).${truncatedHint}`
    );
  }

  return {
    cards,
    outputTokens: message.usage?.output_tokens ?? 0,
    stopReason: message.stop_reason ?? "unknown",
  };
}
