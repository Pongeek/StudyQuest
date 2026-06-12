/**
 * Single source of truth for all loading **Chrome** — the static, hand-written
 * status copy shown while the app waits.
 *
 * Two shapes live here:
 *   1. {@link OVERLAY_COPY} — cycling presets for the full-screen GradingOverlay,
 *      keyed by the kind of completion AI work (quiz / boss / exam, plus a
 *      generic fallback). Only surfaces that do real completion AI work get an
 *      overlay; short inline waits do NOT (see below).
 *   2. {@link INLINE_COPY} — one static line per inline/panel surface, keyed by
 *      surface. A short wait on a small surface never reaches message 2 of a
 *      carousel, so inline surfaces get a single line, never a cycle.
 *
 * Rules (see the Surfaces section of CONTEXT.md):
 *   - This is Chrome, not Content: always English, hand-written, never
 *     AI-generated and never bilingual. No language parameter.
 *   - Restrained / ambient register ("Weighing your trial…"), matching the
 *     Loremaster persona's "plain language, never theatrical" rule. NOT
 *     first-person theater ("The Loremaster consults the tome…").
 *   - Never self-reference as an AI. The `/\bAI\b/` guard test in
 *     loading-copy.test.ts enforces this and cannot be silently regressed.
 */

/** Completion-wait surfaces that pop the full-screen overlay. */
export type OverlayKind = "quiz" | "boss" | "exam" | "generic";

export interface OverlayCopy {
  /** Pixel-font title shown under the sigil. */
  title: string;
  /** Ambient status lines cycled while the overlay is visible. */
  messages: string[];
}

/**
 * Cycling presets for the full-screen GradingOverlay. Only the three surfaces
 * with real completion AI work (quiz / boss / exam) plus a generic fallback.
 * Review and Feynman are deliberately absent — they have no completion overlay
 * (Review's /complete makes no AI call; Feynman is multi-turn inline).
 */
export const OVERLAY_COPY: Record<OverlayKind, OverlayCopy> = {
  quiz: {
    title: "Weighing the trial",
    messages: [
      "Reading your answers…",
      "Weighing each response…",
      "Consulting the archive…",
      "Composing your debrief…",
    ],
  },
  boss: {
    title: "Tallying the battle",
    messages: [
      "Recounting your strikes…",
      "Measuring the boss's wounds…",
      "Forging the victory record…",
      "Inscribing the outcome…",
    ],
  },
  exam: {
    title: "Sealing the scroll",
    messages: [
      "Examining each response…",
      "Cross-checking the answers…",
      "Drafting your final results…",
      "Predicting your score…",
      "Preparing the debrief…",
    ],
  },
  generic: {
    title: "Working",
    messages: ["Gathering the threads…", "One moment…", "Almost there…"],
  },
};

/** Inline/panel surfaces that show a single static line beside a spinner. */
export type InlineSurface =
  | "regenerateQuestion"
  | "clarifier"
  | "cheatSheet"
  | "runes"
  | "scroll"
  | "reviewGrade"
  | "reviewFinish"
  | "feynmanTurn";

/**
 * One restrained line per inline surface. Plain visible text shown next to the
 * existing spinner — no carousel, no new aria-live region.
 */
export const INLINE_COPY: Record<InlineSurface, string> = {
  regenerateQuestion: "Reforging…",
  clarifier: "Weighing your stumble…",
  cheatSheet: "Forging the page…",
  runes: "Forging runes…",
  scroll: "Unrolling the scroll…",
  reviewGrade: "Weighing your answer…",
  reviewFinish: "Filing your progress…",
  feynmanTurn: "The student considers…",
};

/** Resolve the overlay preset for a kind (falls back to `generic`). */
export function getOverlayCopy(kind: OverlayKind = "generic"): OverlayCopy {
  return OVERLAY_COPY[kind] ?? OVERLAY_COPY.generic;
}

/** Resolve the single line for an inline surface. */
export function getInlineCopy(surface: InlineSurface): string {
  return INLINE_COPY[surface];
}
