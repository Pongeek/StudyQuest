import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gradeExamAnswer } from "@/lib/ai/grade-exam-answer";

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

  const { questionId, userAnswer } = await request.json();

  const { data: question } = await supabase
    .from("exam_questions")
    .select("content, model_answer, marks, type, correct_answer")
    .eq("id", questionId)
    .single();

  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

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
    // Open question: AI grading via Claude
    const grading = await gradeExamAnswer({
      question: question.content,
      modelAnswer: question.model_answer,
      marks: question.marks,
      studentAnswer: userAnswer,
      mode: session.mode as "timed" | "assisted",
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
      })
      .eq("id", existingAnswer.id);
  } else {
    await supabase.from("exam_answers").insert({
      exam_session_id: examSessionId,
      exam_question_id: questionId,
      user_answer: userAnswer,
      ai_score: score,
      ai_feedback: feedback,
    });
  }

  return NextResponse.json({
    score,
    feedback,
    modelAnswer: modelAnswerForResponse,
  });
}
