/**
 * Classifies a thrown error from `processEpisodeAsync` into a user-facing
 * message that's actionable, not technical. The classification is best-
 * effort — Anthropic error messages aren't structured enough to inspect
 * by code reliably, so we match on substrings.
 *
 * Used by:
 *   - The catch handler in `api/courses/[id]/episodes/route.ts` to store
 *     `episodes.error_message` for the FailedEpisodesBanner
 *   - (Future) Same classifier could power a client-side pre-upload
 *     size warning so we never even submit a 25 MB+ PDF
 */

export interface ClassifiedEpisodeError {
  /** Stable string identifier — kept in sync with the message but useful
   *  for analytics / future programmatic handling. */
  code:
    | "PDF_TOO_LARGE"
    | "RATE_LIMITED"
    | "AUTH_ERROR"
    | "NO_TEXT"
    | "ZERO_QUESTIONS"
    | "TIMEOUT"
    | "UNKNOWN";
  /** Short, plain-language sentence shown to the student. Ends with a
   *  period. No "Sorry" or "Please" — the Loremaster doesn't grovel. */
  userMessage: string;
}

export function classifyEpisodeError(err: unknown): ClassifiedEpisodeError {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();

  // Anthropic 413 — request body too big. Most common cause: the user
  // uploaded a large PDF and the native document content block pushed
  // the request past Anthropic's per-request size limit.
  if (
    msg.includes("413") ||
    msg.includes("request_too_large") ||
    msg.includes("request exceeds the maximum size")
  ) {
    return {
      code: "PDF_TOO_LARGE",
      userMessage:
        "This PDF was too large for the AI to process. Try splitting it into smaller chunks — roughly 30 pages or 20 MB per upload works best.",
    };
  }

  // Anthropic 429 — rate limited.
  if (msg.includes("429") || msg.includes("rate_limit") || msg.includes("rate limit")) {
    return {
      code: "RATE_LIMITED",
      userMessage:
        "The AI service is busy right now. Wait a minute, then delete this episode and try again.",
    };
  }

  // Misconfigured key — usually a deploy/env issue, not the user's fault.
  if (msg.includes("401") || msg.includes("invalid api key") || msg.includes("unauthorized")) {
    return {
      code: "AUTH_ERROR",
      userMessage:
        "Server configuration issue — the AI service couldn't authenticate. Contact the admin.",
    };
  }

  // Surfaced by the extract pipeline when the PDF has no extractable
  // text (scanned image, image-only PDF). See NO_TEXT_LAYER guard in
  // api/exams/process.
  if (msg.includes("no_text_layer") || msg.includes("no extractable text")) {
    return {
      code: "NO_TEXT",
      userMessage:
        "This PDF has no extractable text — it looks like a scanned image. Try a text-based PDF, or OCR it first.",
    };
  }

  // The AI returned an empty topic set — usually means the PDF was
  // off-topic, a cover page, or otherwise not useful as study material.
  if (msg.includes("zero_questions") || msg.includes("no topics extracted")) {
    return {
      code: "ZERO_QUESTIONS",
      userMessage:
        "The AI couldn't find any study material in this PDF. Make sure it contains actual course content, not just a cover page or table of contents.",
    };
  }

  // Vercel function timeout (300s default, configured on the route).
  if (msg.includes("timeout") || msg.includes("function timed out")) {
    return {
      code: "TIMEOUT",
      userMessage:
        "Extraction took too long and timed out. Try a smaller PDF (under 50 pages) — the AI is more reliable with shorter chunks.",
    };
  }

  // Catch-all — message includes the truncated raw error so we have at
  // least a chance to debug from the user's screenshot.
  return {
    code: "UNKNOWN",
    userMessage:
      "Something went wrong while extracting topics. Try a different or smaller PDF. If it keeps failing, delete this episode and reach out.",
  };
}
