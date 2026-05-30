// Per-topic cheat sheet generator.
//
// Produces a one-page Markdown + LaTeX summary of a topic the student
// can scan before an exam. NOT a textbook section — a CHEAT SHEET:
// terse, formula-heavy, no preamble. Loremaster persona keeps tone
// consistent with the rest of the AI surface.
//
// Cost: ~$0.02 / generation at max_tokens=1536, Sonnet 4.6. Cached
// on topics.cheat_sheet (migration 022) so repeat visits are free.

import Anthropic from "@anthropic-ai/sdk";
import { withCoachPersona } from "@/lib/ai/coach-persona";

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

export interface CheatSheetInput {
  topicTitle: string;
  topicSummary: string;
  keyConcepts: string[];
  episodeTitle: string;
  courseSubject: string;
  /** Optional: pulls from the source PDF excerpt if the topic has it. */
  sourceExcerpt?: string | null;
  /** "en" | "he" | "auto" — same convention as the question generators. */
  outputLanguage?: "auto" | "en" | "he";
}

export interface CheatSheetReply {
  content: string;
  outputTokens: number;
  stopReason: string;
}

function buildLanguageRule(lang: "auto" | "en" | "he"): string {
  if (lang === "en") {
    return "Write ALL output in ENGLISH. Override any other language signal from the source.";
  }
  if (lang === "he") {
    return "Write ALL output in HEBREW. Override any other language signal from the source.";
  }
  return "Write in the SAME LANGUAGE as the topic summary (Hebrew → Hebrew, English → English).";
}

export async function generateCheatSheet(input: CheatSheetInput): Promise<CheatSheetReply> {
  const {
    topicTitle,
    topicSummary,
    keyConcepts,
    episodeTitle,
    courseSubject,
    sourceExcerpt,
  } = input;
  const outputLanguage = input.outputLanguage ?? "auto";

  const task = `Produce a ONE-PAGE cheat sheet for the topic below. This is a study aid for the student to scan before an exam — NOT a textbook section.

Course Subject: ${courseSubject}
Episode: ${episodeTitle}
Topic: ${topicTitle}
Summary: ${topicSummary}
Key Concepts: ${keyConcepts.slice(0, 12).join(", ")}
${sourceExcerpt ? `Source excerpt:\n${sourceExcerpt.slice(0, 1500)}\n` : ""}

STRUCTURE (use these section headings as Markdown ## ):
1. Key definitions
2. Core formulas / results
3. Worked example
4. Common pitfalls

RULES
- Terse, formula-heavy, no preamble or motivational copy. The student already knows what the topic is.
- Use LaTeX for all math. Display math on its own line: $$...$$. Inline math only for SINGLE-SYMBOL refs like $q_0$, $\\Sigma$, $\\delta$, $|w|$.
- Tables: GFM pipe syntax. NEVER whitespace-aligned tables.
- Limit total length to roughly one printed page (~400-600 words). Cut padding; keep substance.
- For CS theory / math / logic: include set-builder, quantifiers, subscripts as full LaTeX.
- ${buildLanguageRule(outputLanguage)}

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

6. When you need to present a formula in Hebrew context, structure is ALWAYS:
   - Line A: Hebrew prose sentence ending with colon, using Unicode symbols for any inline notation.
   - Blank line.
   - Line B: $$...display math in pure LaTeX with English \\text{} only...$$
   - Blank line.
   - Continue with next Hebrew prose if needed.

7. TABLES in Hebrew context: a cell is EITHER pure Hebrew prose (Unicode symbols allowed, no $) OR a pure $...$ math token (no Hebrew). NEVER mix in one cell. Prefer wider tables with one math col + one Hebrew col.

== EXAMPLE — CORRECT HEBREW CHEAT SHEET SNIPPET ==

## הגדרות מפתח

NFA הוא חמישייה (Q, Σ, δ, q₀, F) שבה פונקציית המעבר δ מאפשרת מעברי-ε.

פונקציית המעבר:

$$\\delta : Q \\times \\Sigma_{\\varepsilon} \\to \\mathcal{P}(Q)$$

ε-סגור של קבוצה R ⊆ Q: כל המצבים הניתנים להגעה מ-R באמצעות מעברי-ε בלבד.

$$E(R) = \\{q \\in Q \\mid q \\text{ reachable from } R \\text{ via } \\varepsilon\\text{-transitions only}\\}$$

== EXAMPLE — WRONG ==

WRONG (rule 1 violation — $ in Hebrew line, will scramble):
   "לכל $R \\subseteq Q$, $E(R) = \\{q \\mid q$ מושג מ-$R\\}$"

WRONG (rule 2 violation — Hebrew inside math):
   "$$E(R) = \\{q \\in Q \\mid q \\text{ מושג מ-} R\\}$$"

For English output, the original prompt rules apply — inline $...$ is fine in English prose. The strict rules above are ONLY for Hebrew.

OUTPUT: pure Markdown only. No code fences around the response. No "Here is the cheat sheet:" preamble. Start with the ## Key definitions heading and end with the last bullet of Common pitfalls.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1536,
    system: withCoachPersona(task),
    messages: [{ role: "user", content: "Generate the cheat sheet now." }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Cheat sheet generation returned no text block");
  }

  return {
    content: textBlock.text.trim(),
    outputTokens: response.usage.output_tokens,
    stopReason: response.stop_reason ?? "unknown",
  };
}
