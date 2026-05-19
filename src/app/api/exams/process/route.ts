import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractTextFromBuffer } from "@/lib/pdf/extract-text";
import { extractExamQuestions } from "@/lib/ai/extract-exam-questions";

// Extracting all questions from a long Hebrew past exam can take 1–3 min
// for Claude to write — keep ample headroom over the default 10s timeout.
export const maxDuration = 300;

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
  } catch {
    return NextResponse.json({ error: "Failed to parse upload" }, { status: 400 });
  }

  const courseId = formData.get("courseId") as string;
  if (!courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, theme_name, user_id")
    .eq("id", courseId)
    .eq("user_id", dbUser.id)
    .single();

  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const storagePath = `courses/${courseId}/exams/${Date.now()}-${file.name}`;
  await supabase.storage
    .from("course-files")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

  const fileUrl = supabase.storage.from("course-files").getPublicUrl(storagePath).data.publicUrl;

  const { data: courseFile } = await supabase
    .from("course_files")
    .insert({
      course_id: courseId,
      file_url: fileUrl,
      file_name: file.name,
      file_size: buffer.length,
      file_type: "past_exam",
    })
    .select()
    .single();

  if (!courseFile) {
    return NextResponse.json({ error: "Failed to save file record" }, { status: 500 });
  }

  try {
    const pdfText = await extractTextFromBuffer(buffer);
    const trimmed = pdfText.trim();

    if (!trimmed) {
      return NextResponse.json(
        {
          error: "Could not extract text from PDF",
          code: "EMPTY_PDF_TEXT",
          detail: "The PDF appears to be empty or unreadable.",
        },
        { status: 422 }
      );
    }

    // Heuristic: detect scanned-image PDFs that have no real text layer.
    // A real exam paper averages 1000+ chars of question text. If extraction
    // returns mostly page numbers / junk, the longest "word" tends to be a
    // 4-5 digit page reference and the total character count is tiny. Reject
    // before paying for a Claude call that will just say "I can't see the
    // questions."
    const meaningfulWords = trimmed.match(/[\p{L}\p{N}]{4,}/gu) ?? [];
    if (trimmed.length < 800 || meaningfulWords.length < 50) {
      console.warn(
        `[exam-process] rejecting "${file.name}" — likely scanned image PDF. ` +
        `text length=${trimmed.length}, words≥4ch=${meaningfulWords.length}`
      );
      // Roll back the course_files row we just inserted so the user doesn't
      // see a permanent zero-questions entry in their Past Exams list.
      await supabase.from("course_files").delete().eq("id", courseFile.id);
      return NextResponse.json(
        {
          error: "Could not read questions from this PDF",
          code: "NO_TEXT_LAYER",
          detail:
            "This PDF looks like a scanned image without a text layer. Re-export it from a PDF tool with OCR enabled (Adobe Acrobat / Preview / online OCR services all support this), then upload again.",
        },
        { status: 422 }
      );
    }

    const courseName = course.theme_name || course.title;
    const questions = await extractExamQuestions(pdfText, courseName);

    // If the extractor succeeded but returned zero questions, that's not a
    // success — surface it so the user knows to try a different file or
    // re-export with OCR.
    if (questions.length === 0) {
      await supabase.from("course_files").delete().eq("id", courseFile.id);
      return NextResponse.json(
        {
          error: "No questions extracted from this PDF",
          code: "ZERO_QUESTIONS",
          detail:
            "The AI couldn't identify any exam questions in the extracted text. The PDF may not contain actual exam questions, or its text layer may be too fragmented. Try a different exam paper or re-export with OCR enabled.",
        },
        { status: 422 }
      );
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await supabase.from("exam_questions").insert({
        course_id: courseId,
        source_file_id: courseFile.id,
        content: q.content,
        model_answer: q.model_answer,
        topic_ids: q.key_topics,
        marks: q.marks,
        order_index: i,
        type: q.type ?? "open",
        options: q.options ?? null,
        correct_answer: q.correct_answer ?? null,
      });
    }

    return NextResponse.json({
      fileId: courseFile.id,
      questionCount: questions.length,
    });
  } catch (err) {
    console.error("Exam processing error:", err);
    return NextResponse.json({ error: "Failed to process exam" }, { status: 500 });
  }
}
