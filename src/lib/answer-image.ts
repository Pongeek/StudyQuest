/**
 * Helpers for student-uploaded diagram images on open-question answers.
 *
 * Images are stored in the existing `course-files` Supabase bucket under
 * `answers/<userId>/<sessionId>/<questionId>-<ts>.<ext>` so we don't need
 * a separate bucket / new RLS policies.
 *
 * One image per answer. Max 5MB. Accepts jpg/jpeg/png/webp.
 */
import { createServiceClient } from "@/lib/supabase/server";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Supported MIME types for diagram uploads. HEIC etc. would need conversion. */
const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export interface UploadedAnswerImage {
  /** Supabase Storage path — saved in the answer row as image_url */
  storagePath: string;
  /** MIME type — needed downstream to build a Claude vision content block */
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  /** Original file buffer — passed inline to Claude (base64) for grading */
  buffer: Buffer;
}

/**
 * Validate + upload a student-submitted answer image to Supabase Storage.
 * Returns null when no file was attached (the multipart field is empty/absent).
 * Throws a descriptive error if the file is too big or has a bad MIME type.
 */
export async function uploadAnswerImage(params: {
  file: File | null;
  userId: string;
  sessionId: string;
  questionId: string;
}): Promise<UploadedAnswerImage | null> {
  const { file, userId, sessionId, questionId } = params;
  if (!file) return null;
  if (file.size === 0) return null;

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is 5 MB. Compress it (e.g. lower resolution) and try again.`
    );
  }

  const rawType = (file.type || "").toLowerCase();
  if (!ALLOWED_MEDIA_TYPES.has(rawType)) {
    throw new Error(
      `Unsupported image type "${rawType || "unknown"}". Use JPG, PNG, or WebP.`
    );
  }

  // Normalize image/jpg → image/jpeg for downstream consistency
  const mediaType: UploadedAnswerImage["mediaType"] =
    rawType === "image/jpg" ? "image/jpeg" : (rawType as UploadedAnswerImage["mediaType"]);

  const buffer = Buffer.from(await file.arrayBuffer());

  // Path layout: answers/<userId>/<sessionId>/<questionId>-<ts>.<ext>
  const ext = mediaType === "image/jpeg" ? "jpg" : mediaType === "image/png" ? "png" : "webp";
  const ts = Date.now();
  const storagePath = `answers/${userId}/${sessionId}/${questionId}-${ts}.${ext}`;

  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from("course-files")
    .upload(storagePath, buffer, {
      contentType: mediaType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload answer image: ${error.message}`);
  }

  return { storagePath, mediaType, buffer };
}

/**
 * Build the Anthropic vision content block for an uploaded image. Inlined
 * as base64 rather than passed as a URL — Supabase URLs need signed-URL
 * generation that's tedious to do here, and base64 is rock-solid.
 */
export function buildClaudeImageBlock(image: UploadedAnswerImage): {
  type: "image";
  source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string };
} {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: image.mediaType,
      data: image.buffer.toString("base64"),
    },
  };
}
