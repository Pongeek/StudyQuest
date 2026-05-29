/**
 * Client-side PDF size validation for the episode upload form.
 *
 * Two thresholds:
 *  - WARN_MB (20): we let the upload proceed but warn the user that
 *    extraction may take several minutes. Big PDFs are slow even when
 *    they succeed.
 *  - BLOCK_MB (32): Anthropic's PDF document-content-block limit.
 *    Larger files will reliably 413 server-side -- we'd rather catch
 *    that BEFORE the user waits 30s for the upload to fail. The
 *    server still has `episode-error.ts` classifying PDF_TOO_LARGE as
 *    a safety net for anything that slips past.
 *
 * Pure, no React dependency, easy to unit-test if we ever add Jest.
 */

export const UPLOAD_WARN_MB = 20;
export const UPLOAD_BLOCK_MB = 32;

export type UploadTier = "ok" | "warn" | "error";

export interface UploadValidationResult {
  tier: UploadTier;
  /** Pre-formatted user-facing message (null for the "ok" tier). */
  message: string | null;
  /** Size in MB, rounded to one decimal — surface this in the chip. */
  sizeMb: number;
}

/**
 * Validate ONE file. Pre-formats the user-facing message so the caller
 * doesn't have to. Names the file in the message for the rejection-toast
 * use case (drop multiple files at once).
 */
export function validatePdfSize(file: File): UploadValidationResult {
  const sizeMb = Math.round((file.size / 1024 / 1024) * 10) / 10;

  if (sizeMb > UPLOAD_BLOCK_MB) {
    return {
      tier: "error",
      sizeMb,
      message: `${file.name} is ${sizeMb} MB — over the ${UPLOAD_BLOCK_MB} MB limit. Split into smaller chapters and try again.`,
    };
  }
  if (sizeMb >= UPLOAD_WARN_MB) {
    return {
      tier: "warn",
      sizeMb,
      message: `Large file (${sizeMb} MB) — extraction may take several minutes.`,
    };
  }
  return { tier: "ok", sizeMb, message: null };
}
