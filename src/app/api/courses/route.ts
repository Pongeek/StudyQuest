import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractPagesFromBuffer } from "@/lib/pdf/extract-text";
import { extractCourseStructure } from "@/lib/ai/extract-course";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error("FormData parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse upload. File may be too large." },
      { status: 400 }
    );
  }
  const title = formData.get("title") as string;
  const fileCount = parseInt(formData.get("fileCount") as string, 10);

  // Output language override — defaults to 'auto' (match source PDF).
  // Validated against the same set the DB CHECK constraint enforces so a
  // malformed client request can't get past the type system.
  const rawLang = formData.get("outputLanguage");
  const outputLanguage: "auto" | "en" | "he" =
    rawLang === "en" || rawLang === "he" ? rawLang : "auto";

  // Create course record first
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      user_id: dbUser.id,
      title: title || "Untitled Course",
      status: "processing",
      output_language: outputLanguage,
    })
    .select()
    .single();

  if (courseError || !course) {
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }

  // Collect file data and upload to Supabase Storage
  const filesData: Array<{ buffer: Buffer; name: string; type: string }> = [];

  for (let i = 0; i < fileCount; i++) {
    const file = formData.get(`file_${i}`) as File | null;
    const fileType = (formData.get(`type_${i}`) as string) || "lecture";

    if (!file) continue;

    const buffer = Buffer.from(await file.arrayBuffer());
    filesData.push({ buffer, name: file.name, type: fileType });

    // Sanitize filename for storage path — replace non-ASCII chars to avoid
    // Supabase Storage InvalidKey errors with Hebrew/Arabic/etc filenames
    const ext = file.name.replace(/.*\./, ".");
    const sanitizedName = `${Date.now()}-file${i}${ext}`;
    const storagePath = `courses/${course.id}/${sanitizedName}`;
    const { data: uploadData } = await supabase.storage
      .from("course-files")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    // Store the raw storage path — the proxy API will generate signed URLs
    const fileUrl = storagePath;

    await supabase.from("course_files").insert({
      course_id: course.id,
      file_url: fileUrl,
      file_name: file.name, // Keep original name for display
      file_size: buffer.length,
      file_type: fileType,
    });
  }

  // Start async AI processing (fire and forget pattern)
  processCoursesAsync(course.id, filesData, outputLanguage).catch(async (err) => {
    // Detailed structured logging — surfaces in `npm run dev` terminal locally
    // and in Vercel Function Logs in production. Includes the courseId so the
    // failure can be traced back to a specific row in the DB.
    console.error("=== Course processing error ===");
    console.error("Course ID:", course.id);
    console.error("Error type:", err?.constructor?.name);
    console.error("Error message:", err instanceof Error ? err.message : String(err));
    console.error("Stack:", err instanceof Error ? err.stack : "(no stack)");
    console.error("================================");
    await supabase.from("courses").update({ status: "error" }).eq("id", course.id);
  });

  return NextResponse.json({ courseId: course.id }, { status: 201 });
}

async function processCoursesAsync(
  courseId: string,
  files: Array<{ buffer: Buffer; name: string; type: string }>,
  outputLanguage: "auto" | "en" | "he"
) {
  const supabase = createServiceClient();

  // Only process lecture/notes files for course structure
  const contentFiles = files.filter((f) => f.type !== "past_exam");

  if (contentFiles.length === 0) {
    await supabase
      .from("courses")
      .update({ status: "error" })
      .eq("id", courseId);
    return;
  }

  // Page count is still useful for the course_files record (used later to
  // display "X pages" in the UI). The actual text isn't sent to Claude any
  // more — Claude reads the PDFs natively via document blocks.
  const primaryFileName = contentFiles[0].name;
  let primaryFilePageCount = 0;
  try {
    const result = await extractPagesFromBuffer(contentFiles[0].buffer);
    primaryFilePageCount = result.totalPages;
  } catch (err) {
    console.warn(`Failed to count pages in ${primaryFileName}:`, err);
  }

  // Update page count on the course_files record(s)
  if (primaryFilePageCount > 0) {
    await supabase
      .from("course_files")
      .update({ page_count: primaryFilePageCount })
      .eq("course_id", courseId)
      .eq("file_name", primaryFileName);
  }

  // Ask Claude to build the course structure — passing PDF buffers directly
  // so Claude reads them natively (preserves math notation, diagrams, etc.).
  const pdfsForExtraction = contentFiles.map((f) => ({
    name: f.name,
    buffer: f.buffer,
  }));
  const structure = await extractCourseStructure(pdfsForExtraction, outputLanguage);

  // Persist course metadata
  await supabase
    .from("courses")
    .update({
      title: structure.subject || primaryFileName.replace(".pdf", ""),
      subject: structure.subject,
      theme_name: structure.theme_name,
      episode_count: structure.episodes.length,
      topic_count: structure.episodes.reduce((sum, ep) => sum + ep.topics.length, 0),
    })
    .eq("id", courseId);

  // Look up the primary source file ID for linking topics
  const { data: sourceFileRow } = await supabase
    .from("course_files")
    .select("id")
    .eq("course_id", courseId)
    .eq("file_name", primaryFileName)
    .single();

  const sourceFileId = sourceFileRow?.id ?? null;

  // Insert episodes and topics
  for (let epIdx = 0; epIdx < structure.episodes.length; epIdx++) {
    const ep = structure.episodes[epIdx];

    const { data: episodeRow } = await supabase
      .from("episodes")
      .insert({
        course_id: courseId,
        title: ep.title,
        description: ep.description,
        order_index: epIdx,
      })
      .select()
      .single();

    if (!episodeRow) continue;

    // First pass: insert all topics without prerequisites
    const topicRows: Array<{ id: string; title: string }> = [];
    for (let tIdx = 0; tIdx < ep.topics.length; tIdx++) {
      const topic = ep.topics[tIdx];

      // Build source_pages JSONB if AI returned page numbers
      const sourcePages =
        topic.page_start != null && topic.page_end != null
          ? { start: topic.page_start, end: topic.page_end }
          : null;

      const { data: topicRow } = await supabase
        .from("topics")
        .insert({
          episode_id: episodeRow.id,
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

    // Second pass: wire up prerequisites
    for (let tIdx = 0; tIdx < ep.topics.length; tIdx++) {
      const topic = ep.topics[tIdx];
      if (!topic.prerequisite || !topicRows[tIdx]) continue;

      const prereqRow = topicRows.find((r) => r.title === topic.prerequisite);
      if (prereqRow) {
        await supabase
          .from("topics")
          .update({ prerequisite_topic_id: prereqRow.id })
          .eq("id", topicRows[tIdx].id);
      }
    }
  }

  // Mark as ready
  await supabase.from("courses").update({ status: "ready" }).eq("id", courseId);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", dbUser.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ courses: courses || [] });
}
