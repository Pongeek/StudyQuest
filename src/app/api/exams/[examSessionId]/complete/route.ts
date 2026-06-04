import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateExamDebrief } from "@/lib/ai/grade-exam-answer";
import { awardSessionAchievements } from "@/lib/achievements";

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
    .select("id, total_xp, current_streak")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Optional body: { maxCombo?: number } — sent by the exam engine so we
  // can check the Combo Breaker achievement (5x consecutive correct
  // answers in a single session, silently tracked during exam mode).
  let maxCombo = 0;
  try {
    const body = await request.json();
    if (typeof body?.maxCombo === "number") maxCombo = body.maxCombo;
  } catch {
    // No body / invalid JSON — fine, maxCombo stays 0.
  }

  const { data: session } = await supabase
    .from("exam_sessions")
    .select("id, mode, user_id, source_file_id")
    .eq("id", examSessionId)
    .eq("user_id", dbUser.id)
    .single();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: sourceFile } = await supabase
    .from("course_files")
    .select("course_id")
    .eq("id", session.source_file_id)
    .single();

  const { data: course } = await supabase
    .from("courses")
    .select("title, theme_name")
    .eq("id", sourceFile?.course_id)
    .single();

  const { data: examQuestions } = await supabase
    .from("exam_questions")
    .select("id, content, marks, topic_ids")
    .eq("source_file_id", session.source_file_id)
    .order("order_index");

  const { data: examAnswers } = await supabase
    .from("exam_answers")
    .select("exam_question_id, ai_score, ai_feedback")
    .eq("exam_session_id", examSessionId);

  const answerMap = new Map<string, any>(
    (examAnswers || []).map((a: any) => [a.exam_question_id, a])
  );

  const questions = (examQuestions || []).map((q: any) => ({
    content: q.content,
    marks: q.marks,
    key_topics: q.topic_ids || [],
  }));

  const answers = (examQuestions || []).map((q: any) => {
    const ans = answerMap.get(q.id);
    return {
      score: ans ? Number(ans.ai_score) : 0,
      feedback: ans?.ai_feedback || "Not answered",
    };
  });

  const courseName = course?.theme_name || course?.title || "Course";
  const debrief = await generateExamDebrief({ questions, answers, courseName });

  await supabase
    .from("exam_sessions")
    .update({
      completed_at: new Date().toISOString(),
      predicted_score: debrief.predicted_score_pct,
      exam_readiness: debrief.exam_readiness,
      debrief,
    })
    .eq("id", examSessionId);

  const xpEarned = Math.round(debrief.predicted_score_pct * 2);
  await supabase.rpc("increment_user_xp", { p_user_id: dbUser.id, amount: xpEarned });

  // Achievements — evaluate every applicable Condition via the shared
  // condition-based evaluator (evaluate-all; replaces the combo-only fork).
  // Exam has no clean correctness % (scorePct null → perfect_day can't fire
  // from a predicted-100 exam) and doesn't advance the streak (newStreak is the
  // unchanged current streak). maxCombo (silently tracked) drives combo_session;
  // quiz-only badges never fire here. The shell applies condition XP via the
  // same atomic increment_user_xp RPC used for the session XP above.
  const newAchievements = await awardSessionAchievements({
    userId: dbUser.id,
    supabase,
    sessionType: "exam",
    scorePct: null,
    maxCombo,
    sessionDurationMs: null,
    newStreak: dbUser.current_streak ?? 0,
    completedEpisodeIds: [],
  });

  return NextResponse.json({
    predictedScore: debrief.predicted_score_pct,
    examReadiness: debrief.exam_readiness,
    strongestAreas: debrief.strongest_areas,
    criticalGaps: debrief.critical_gaps,
    recommendedTopics: debrief.recommended_topics,
    summary: debrief.summary,
    xpEarned,
    /** Prior total XP before this exam — used by engines for level-up detection */
    previousTotalXp: (dbUser.total_xp as number | null) ?? 0,
    newAchievements,
  });
}
