import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import ExamEngine from "@/components/exam/ExamEngine";
import ExamDebrief from "@/components/exam/ExamDebrief";

// ─── Active session data (exam not yet complete) ─────────────────────────────

async function getActiveSessionData(
  examSessionId: string,
  courseId: string,
  dbUserId: string
) {
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from("exam_sessions")
    .select("id, mode, source_file_id, completed_at")
    .eq("id", examSessionId)
    .eq("user_id", dbUserId)
    .single();

  if (!session || session.completed_at) return null;

  const { data: sourceFile } = await supabase
    .from("course_files")
    .select("file_name, course_id")
    .eq("id", session.source_file_id)
    .single();

  if (!sourceFile || sourceFile.course_id !== courseId) return null;

  const { data: questions } = await supabase
    .from("exam_questions")
    .select("id, content, marks, order_index, type, options, correct_answer")
    .eq("source_file_id", session.source_file_id)
    .order("order_index");

  return {
    type: "active" as const,
    session,
    questions: questions || [],
    examTitle: sourceFile.file_name.replace(".pdf", ""),
  };
}

// ─── Completed session data (review) ─────────────────────────────────────────

async function getCompletedSessionData(
  examSessionId: string,
  courseId: string,
  dbUserId: string
) {
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from("exam_sessions")
    .select(
      // NOTE: exam_sessions does NOT have an xp_earned column (unlike
      // quiz_sessions / boss_fight_sessions). The XP awarded at completion
      // is calculated from predicted_score in /api/exams/[id]/complete and
      // we mirror that derivation below — single source of truth.
      "id, mode, source_file_id, predicted_score, exam_readiness, debrief, started_at, completed_at"
    )
    .eq("id", examSessionId)
    .eq("user_id", dbUserId)
    .single();

  if (!session || !session.completed_at) return null;

  const { data: sourceFile } = await supabase
    .from("course_files")
    .select("file_name, course_id")
    .eq("id", session.source_file_id)
    .single();

  if (!sourceFile || sourceFile.course_id !== courseId) return null;

  // Fetch answers joined with their questions (ordered by question order_index)
  type ExamAnswerRow = {
    exam_question_id: string;
    user_answer: string | null;
    ai_score: number | null;
    ai_feedback: string | null;
    exam_questions: {
      id: string;
      content: string;
      marks: number;
      model_answer: string | null;
      order_index: number;
      type: "mcq" | "open";
      options: string[] | null;
      correct_answer: string | null;
    };
  };

  const { data: examAnswersRaw } = await supabase
    .from("exam_answers")
    .select(
      "exam_question_id, user_answer, ai_score, ai_feedback, exam_questions!inner(id, content, marks, model_answer, order_index, type, options, correct_answer)"
    )
    .eq("exam_session_id", examSessionId);

  const examAnswers = (examAnswersRaw || []) as ExamAnswerRow[];

  // Sort by question order_index
  const sortedAnswers = examAnswers.slice().sort((a, b) => {
    return a.exam_questions.order_index - b.exam_questions.order_index;
  });

  // Build results array — always include model_answer for the review view
  const results = sortedAnswers.map((a) => {
    const q = a.exam_questions;
    return {
      questionId: q.id,
      question: q.content,
      userAnswer: a.user_answer ?? "",
      score: typeof a.ai_score === "number" ? a.ai_score : 0,
      feedback: a.ai_feedback ?? "No feedback available.",
      modelAnswer: q.model_answer ?? undefined,
      marks: q.marks,
      type: q.type,
      options: q.options ?? undefined,
      correctAnswer: q.correct_answer ?? undefined,
    };
  });

  // Elapsed seconds from session timestamps
  const elapsedSeconds =
    session.started_at && session.completed_at
      ? Math.round(
          (new Date(session.completed_at).getTime() -
            new Date(session.started_at).getTime()) /
            1000
        )
      : 0;

  // Parse debrief JSONB
  const debrief = (session.debrief as {
    strongest_areas?: string[];
    critical_gaps?: string[];
    recommended_topics?: string[];
    summary?: string;
  } | null) ?? {};

  const predictedScore =
    typeof session.predicted_score === "number" ? session.predicted_score : 0;

  return {
    type: "completed" as const,
    examTitle: sourceFile.file_name.replace(".pdf", ""),
    mode: session.mode as "timed" | "assisted",
    predictedScore,
    examReadiness: typeof session.exam_readiness === "string" ? session.exam_readiness : "moderate",
    strongestAreas: Array.isArray(debrief.strongest_areas) ? debrief.strongest_areas : [],
    criticalGaps: Array.isArray(debrief.critical_gaps) ? debrief.critical_gaps : [],
    recommendedTopics: Array.isArray(debrief.recommended_topics) ? debrief.recommended_topics : [],
    summary: typeof debrief.summary === "string" ? debrief.summary : "",
    // Same formula as /api/exams/[id]/complete — keep these two in sync.
    xpEarned: Math.round(predictedScore * 2),
    results,
    elapsedSeconds,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ExamSessionPage({
  params,
}: {
  params: Promise<{ id: string; examSessionId: string }>;
}) {
  const { id: courseId, examSessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();

  // Resolve Clerk userId → DB user id
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, total_xp")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) notFound();

  // Try active session first
  const activeData = await getActiveSessionData(examSessionId, courseId, dbUser.id);
  if (activeData) {
    const { session, questions, examTitle } = activeData;

    if (questions.length === 0) {
      return (
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-slate-400">No questions found for this exam.</p>
        </div>
      );
    }

    return (
      <ExamEngine
        examSessionId={examSessionId}
        courseId={courseId}
        questions={questions}
        mode={session.mode as "timed" | "assisted"}
        examTitle={examTitle}
        userTotalXp={(dbUser.total_xp as number | null) ?? 0}
      />
    );
  }

  // Try completed session (review)
  const completedData = await getCompletedSessionData(examSessionId, courseId, dbUser.id);
  if (completedData) {
    return (
      <ExamDebrief
        courseId={courseId}
        examTitle={completedData.examTitle}
        predictedScore={completedData.predictedScore}
        examReadiness={completedData.examReadiness}
        strongestAreas={completedData.strongestAreas}
        criticalGaps={completedData.criticalGaps}
        recommendedTopics={completedData.recommendedTopics}
        summary={completedData.summary}
        xpEarned={completedData.xpEarned}
        results={completedData.results}
        elapsedSeconds={completedData.elapsedSeconds}
        mode={completedData.mode}
      />
    );
  }

  notFound();
}
