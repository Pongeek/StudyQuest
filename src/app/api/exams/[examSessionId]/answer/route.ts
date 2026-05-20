import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gradeExamAnswer } from "@/lib/ai/grade-exam-answer";
import { uploadAnswerImage } from "@/lib/answer-image";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examSessionId: string }> }
) {
  const { examSessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: session } = await supabase
    .from("exam_sessions")
    .select("id, mode, user_id")
    .eq("id", examSessionId)
    .eq("user_id", dbUser.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Accept both JSON (legacy / MCQ + plain open) and multipart (open with
  // attached diagram image).
  const contentType = request.headers.get("content-type") || "";
  let questionId: string;
  let userAnswer: string;
  let imageFile: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData();
    questionId = (fd.get("questionId") as string) ?? "";
    userAnswer = (fd.get("userAnswer") as string) ?? "";
    const f = fd.get("image");
    imageFile = f instanceof File ? f : null;
  } else {
    const body = await request.json();
    questionId = body.questionId;
    userAnswer = body.userAnswer;
  }

  const { data: question } = await supabase
    .from("exam_questions")
    .select("content, model_answer, marks, type, correct_answer")
    .eq("id", questionId)
    .single();

  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  // Upload diagram image (open questions only) — Claude sees it inline.
  const uploadedImage =
    question.type !== "mcq" && imageFile
      ? await uploadAnswerImage({
          file: imageFile,
          userId,
          sessionId: examSessionId,
          questionId,
        })
      : null;

  // ── Compute score + feedback ────────────────────────────────────────────────
  let score: number;
  let feedback: string;
  let modelAnswerForResponse: string | undefined;

  if (question.type === "mcq") {
    // MCQ fast-path: exact-match grading, no Claude call
    const isCorrect =
      typeof question.correct_answer === "string" &&
      userAnswer.trim() === question.correct_answer.trim();

    score = isCorrect ? 1.0 : 0;
    feedback = isCorrect
      ? "Correct! ✓"
      : `Not quite. The correct answer is: ${question.correct_answer ?? "unknown"}`;
    modelAnswerForResponse = question.model_answer ?? undefined;
  } else {
    // Open question: AI grading via Claude (with optional diagram image)
    const grading = await gradeExamAnswer({
      question: question.content,
      modelAnswer: question.model_answer,
      marks: question.marks,
      studentAnswer: userAnswer,
      mode: session.mode as "timed" | "assisted",
      studentImage: uploadedImage
        ? {
            mediaType: uploadedImage.mediaType,
            base64: uploadedImage.buffer.toString("base64"),
          }
        : null,
    });
    score = grading.score;
    feedback = grading.feedback;
    modelAnswerForResponse =
      session.mode === "assisted" ? question.model_answer : undefined;
  }

  // ── Upsert the answer ───────────────────────────────────────────────────────
  // Supports re-submission: when the user edits a previously-locked answer
  // and re-submits, we replace the existing row instead of inserting a
  // duplicate. (The exam_answers table has no unique constraint on
  // (session, question), so we do the existence check by hand.)
  const { data: existingAnswer } = await supabase
    .from("exam_answers")
    .select("id")
    .eq("exam_session_id", examSessionId)
    .eq("exam_question_id", questionId)
    .maybeSingle();

  if (existingAnswer) {
    await supabase
      .from("exam_answers")
      .update({
        user_answer: userAnswer,
        ai_score: score,
        ai_feedback: feedback,
        // Only overwrite image_url if a NEW image was uploaded this time.
        // Re-submitting without a new image preserves the previous one.
        ...(uploadedImage ? { image_url: uploadedImage.storagePath } : {}),
      })
      .eq("id", existingAnswer.id);
  } else {
    await supabase.from("exam_answers").insert({
      exam_session_id: examSessionId,
      exam_question_id: questionId,
      user_answer: userAnswer,
      ai_score: score,
      ai_feedback: feedback,
      image_url: uploadedImage?.storagePath ?? null,
    });
  }

  return NextResponse.json({
    score,
    feedback,
    modelAnswer: modelAnswerForResponse,
  });
}
