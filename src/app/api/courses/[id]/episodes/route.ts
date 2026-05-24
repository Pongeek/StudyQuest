import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractPagesFromBuffer } from "@/lib/pdf/extract-text";
import { extractEpisodeStructure } from "@/lib/ai/extract-episode";
import { classifyEpisodeError } from "@/lib/episode-error";

/**
 * POST /api/courses/[id]/episodes
 *
 * Accepts up to 3 PDFs and creates ONE new episode in the course, with the
 * AI extracting topics + boss-fight metadata from just those PDFs.
 *
 * Multipart form fields:
 *   - file_0, file_1, file_2 (PDFs, max 3)
 *   - fileCount: how many files were uploaded
 *   - title?: user-provided episode title (optional, AI infers if omitted)
 *
 * Returns immediately with the new episode id; the AI extraction runs in
 * the background and the episode's status flips from 'processing' to
 * 'ready' when topics are inserted.
 */
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  // Resolve clerkId → dbUser
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify the user owns this course
  const { data: course } = await supabase
    .from("courses")
    .select("id, user_id, output_language")
    .eq("id", courseId)
    .eq("user_id", dbUser.id)
    .single();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Failed to parse upload. File may be too large." },
      { status: 400 }
    );
  }

  const userTitle = (formData.get("title") as string | null)?.trim() || "";
  const fileCount = Math.min(parseInt((formData.get("fileCount") as string) || "0", 10), 3);
  if (fileCount < 1) {
    return NextResponse.json({ error: "At least one PDF is required" }, { status: 400 });
  }

  // Collect buffers
  const files: Array<{ name: string; buffer: Buffer }> = [];
  for (let i = 0; i < fileCount; i++) {
    const file = formData.get(`file_${i}`) as File | null;
    if (!file) continue;
    files.push({
      name: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No PDFs received" }, { status: 400 });
  }

  // Determine the next order_index for this course
  const { count: existingCount } = await supabase
    .from("episodes")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  const orderIndex = existingCount ?? 0;

  // Create episode row with status='processing' so the UI can show a spinner
  const { data: episode, error: episodeError } = await supabase
    .from("episodes")
    .insert({
      course_id: courseId,
      title: userTitle || "Processing…",
      description: "",
      order_index: orderIndex,
      status: "processing",
    })
    .select("id")
    .single();
  if (episodeError || !episode) {
    return NextResponse.json(
      { error: "Failed to create episode row" },
      { status: 500 }
    );
  }

  // Upload PDFs to storage and create course_files rows linked to the episode
  for (let i = 0; i < files.length; i++) {
    const { name, buffer } = files[i];
    const ext = name.replace(/.*\./, ".");
    const sanitizedName = `${Date.now()}-ep${orderIndex}-file${i}${ext}`;
    const storagePath = `courses/${courseId}/episodes/${episode.id}/${sanitizedName}`;

    await supabase.storage
      .from("course-files")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    await supabase.from("course_files").insert({
      course_id: courseId,
      episode_id: episode.id,
      file_url: storagePath,
      file_name: name,
      file_size: buffer.length,
      file_type: "lecture",
    });
  }

  // Fire-and-forget: run the AI extraction in the background. The route
  // returns immediately so the UI can navigate; the client polls episode
  // status until it flips to 'ready'.
  processEpisodeAsync(
    episode.id,
    courseId,
    files,
    userTitle,
    (course.output_language as "auto" | "en" | "he" | null) ?? "auto"
  ).catch(async (err) => {
    console.error("=== Episode processing error ===");
    console.error("Episode ID:", episode.id);
    console.error("Error type:", err?.constructor?.name);
    console.error("Error message:", err instanceof Error ? err.message : String(err));
    console.error("Stack:", err instanceof Error ? err.stack : "(no stack)");
    console.error("================================");

    // Translate the raw error into a user-facing sentence and persist it
    // on the episode row so FailedEpisodesBanner can read it back. Keep
    // the user's title intact if they provided one — re-uploading later
    // is easier when the title still matches their mental model.
    const { userMessage } = classifyEpisodeError(err);
    await supabase
      .from("episodes")
      .update({
        status: "error",
        title: userTitle || "Failed to process",
        error_message: userMessage,
      })
      .eq("id", episode.id);
  });

  return NextResponse.json(
    { episodeId: episode.id, status: "processing" },
    { status: 201 }
  );
}

// ─── Background processor ────────────────────────────────────────────────────

async function processEpisodeAsync(
  episodeId: string,
  courseId: string,
  files: Array<{ name: string; buffer: Buffer }>,
  userTitle: string,
  outputLanguage: "auto" | "en" | "he"
) {
  const supabase = createServiceClient();

  // Count pages on the PRIMARY PDF (the first file) before calling Claude.
  // The count is critical: we pass it into the AI prompt so Claude uses
  // 1-based PDF indices (1..N) instead of the textbook's printed page
  // numbers (which would otherwise produce out-of-range page_start/page_end
  // like "page 63 of 52"). The count also gets saved for UI display.
  let primaryPageCount = 0;
  try {
    const result = await extractPagesFromBuffer(files[0].buffer);
    primaryPageCount = result.totalPages;
  } catch (err) {
    console.warn("Failed to count pages:", err);
  }

  if (primaryPageCount > 0) {
    await supabase
      .from("course_files")
      .update({ page_count: primaryPageCount })
      .eq("episode_id", episodeId)
      .eq("file_name", files[0].name);
  }

  // AI extraction — Claude reads the PDFs natively
  const structure = await extractEpisodeStructure(files, {
    outputLanguage,
    userProvidedTitle: userTitle || undefined,
    primaryFilePageCount: primaryPageCount,
  });

  // Update the episode with AI-extracted (or user-provided) title + description
  await supabase
    .from("episodes")
    .update({
      title: structure.episode_title,
      description: structure.description,
    })
    .eq("id", episodeId);

  // Find the primary source_file_id for linking topics to the PDF
  const { data: sourceFileRow } = await supabase
    .from("course_files")
    .select("id")
    .eq("episode_id", episodeId)
    .eq("file_name", files[0].name)
    .single();
  const sourceFileId = sourceFileRow?.id ?? null;

  // Insert topics — first pass without prerequisites
  const topicRows: Array<{ id: string; title: string }> = [];
  for (let tIdx = 0; tIdx < structure.topics.length; tIdx++) {
    const topic = structure.topics[tIdx];
    const sourcePages =
      topic.page_start != null && topic.page_end != null
        ? { start: topic.page_start, end: topic.page_end }
        : null;

    const { data: topicRow } = await supabase
      .from("topics")
      .insert({
        episode_id: episodeId,
        title: topic.title,
        summary: topic.summary,
        key_concepts: topic.key_concepts,
        difficulty: topic.difficulty,
        order_index: tIdx,
        source_file_id: sourceFileId,
        source_pages: sourcePages,
      })
      .select("id, title")
      .single();

    if (topicRow) topicRows.push(topicRow);
  }

  // Second pass — wire up prerequisites by title match
  for (let tIdx = 0; tIdx < structure.topics.length; tIdx++) {
    const topic = structure.topics[tIdx];
    if (!topic.prerequisite || !topicRows[tIdx]) continue;
    const prereqRow = topicRows.find((r) => r.title === topic.prerequisite);
    if (prereqRow) {
      await supabase
        .from("topics")
        .update({ prerequisite_topic_id: prereqRow.id })
        .eq("id", topicRows[tIdx].id);
    }
  }

  // Update course-level rollup counts (episode_count, topic_count)
  const { count: episodeCount } = await supabase
    .from("episodes")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  const { count: topicCount } = await supabase
    .from("topics")
    .select("id, episodes!inner(course_id)", { count: "exact", head: true })
    .eq("episodes.course_id", courseId);
  await supabase
    .from("courses")
    .update({
      episode_count: episodeCount ?? 0,
      topic_count: topicCount ?? 0,
    })
    .eq("id", courseId);

  // Mark episode ready
  await supabase
    .from("episodes")
    .update({ status: "ready" })
    .eq("id", episodeId);
}
