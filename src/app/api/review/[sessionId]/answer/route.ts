import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gradeOpenAnswer } from "@/lib/ai/grade-answer";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questionId, userAnswer, topicId } = await request.json();

  if (!questionId || !topicId) {
    return NextResponse.json({ error: "questionId and topicId required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: question } = await supabase
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .single();

  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

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
    });
    score = result.score;
    feedback = result.feedback;
  }

  await supabase.from("review_answers").insert({
    review_session_id: sessionId,
    question_id: questionId,
    topic_id: topicId,
    user_answer: userAnswer,
    ai_score: score,
    ai_feedback: feedback,
  });

  return NextResponse.json({ score, feedback });
}
