import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gradeOpenAnswer } from "@/lib/ai/grade-answer";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, questionId, userAnswer, topicTitle } = await request.json();

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
    feedback = score === 1
      ? `Correct! ${question.explanation}`
      : `The correct answer was: "${question.correct_answer}". ${question.explanation}`;
  } else {
    const result = await gradeOpenAnswer({
      question: question.content,
      modelAnswer: question.correct_answer,
      explanation: question.explanation,
      studentAnswer: userAnswer,
      topicTitle: topicTitle || "",
    });
    score = result.score;
    feedback = result.feedback;
  }

  await supabase.from("quiz_answers").insert({
    session_id: sessionId,
    question_id: questionId,
    user_answer: userAnswer,
    ai_score: score,
    ai_feedback: feedback,
  });

  return NextResponse.json({ score, feedback });
}
