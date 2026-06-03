import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gradeOpenAnswer } from "@/lib/ai/grade-answer";
import { uploadAnswerImage } from "@/lib/answer-image";
import { classifyAiError, classifiedErrorBody } from "@/lib/ai-error";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      classifiedErrorBody(
        "AUTH_ERROR",
        "Your sign-in expired. Refresh the page to sign back in — your typed answer is saved.",
        false,
      ),
      { status: 401 },
    );
  }

  try {

  // JSON (MCQ / plain open) or multipart (open + diagram image)
  const contentType = request.headers.get("content-type") || "";
  let questionId: string;
  let userAnswer: string;
  let topicId: string;
  let imageFile: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData();
    questionId = (fd.get("questionId") as string) ?? "";
    userAnswer = (fd.get("userAnswer") as string) ?? "";
    topicId = (fd.get("topicId") as string) ?? "";
    const f = fd.get("image");
    imageFile = f instanceof File ? f : null;
  } else {
    const body = await request.json();
    questionId = body.questionId;
    userAnswer = body.userAnswer;
    topicId = body.topicId;
  }

  if (!questionId || !topicId) {
    return NextResponse.json(
      classifiedErrorBody(
        "UNKNOWN",
        "The answer payload was malformed — refresh the page and try again.",
        false,
      ),
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: question } = await supabase
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .single();

  if (!question) {
    return NextResponse.json(
      classifiedErrorBody(
        "UNKNOWN",
        "Couldn't find that question — it may have been deleted. Refresh the page.",
        false,
      ),
      { status: 404 },
    );
  }

  // Soft-replaced mid-session — see quiz/answers/route.ts for the full
  // rationale. Refuse with a classified 409 so the engine surfaces a
  // useful "refresh" toast instead of silently grading against retired
  // content.
  if (question.replaced_at) {
    return NextResponse.json(
      {
        error: {
          code: "QUESTION_RETIRED",
          userMessage:
            "This question was just regenerated. Refresh the page to load the new version — your typed answer is saved.",
          retryable: false,
        },
      },
      { status: 409 },
    );
  }

  const uploadedImage =
    question.type !== "mcq" && imageFile
      ? await uploadAnswerImage({
          file: imageFile,
          userId,
          sessionId,
          questionId,
        })
      : null;

  let score = 0;
  let feedback = "";

  if (question.type === "mcq") {
    score = userAnswer === question.correct_answer ? 1 : 0;
    feedback =
      score === 1
        ? `Correct! ${question.explanation}`
        : `The correct answer was: "${question.correct_answer}". ${question.explanation}`;
  } else {
    // Fetch topic title for grading context
    const { data: topic } = await supabase
      .from("topics")
      .select("title")
      .eq("id", topicId)
      .single();

    const result = await gradeOpenAnswer({
      question: question.content,
      modelAnswer: question.correct_answer,
      explanation: question.explanation,
      studentAnswer: userAnswer,
      topicTitle: topic?.title ?? "",
      studentImage: uploadedImage
        ? {
            mediaType: uploadedImage.mediaType,
            base64: uploadedImage.buffer.toString("base64"),
          }
        : null,
    });
    score = result.score;
    feedback = result.feedback;
  }

  // Capture the inserted answer id so the client can PATCH confidence onto
  // this exact row (parallel to the Quiz path). Null on insert failure —
  // the confidence row simply won't render without an answerId.
  const { data: inserted } = await supabase
    .from("review_answers")
    .insert({
      review_session_id: sessionId,
      question_id: questionId,
      topic_id: topicId,
      user_answer: userAnswer,
      ai_score: score,
      ai_feedback: feedback,
      image_url: uploadedImage?.storagePath ?? null,
    })
    .select("id")
    .single();

  return NextResponse.json({ score, feedback, answerId: inserted?.id ?? null });
  } catch (err) {
    console.error("[api/review/answer] grading failed:", err);
    const classified = classifyAiError(err);
    return NextResponse.json({ error: classified }, { status: 502 });
  }
}
