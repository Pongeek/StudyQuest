import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Trophy,
  Zap,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/quiz/MarkdownContent";

function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

async function getSessionReviewData(
  sessionId: string,
  topicId: string,
  courseId: string,
  clerkId: string
) {
  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (!dbUser) return null;

  // Get session with its answers
  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .eq("topic_id", topicId)
    .single();

  if (!session || !session.completed_at) return null;

  // Get all answers for this session with their questions
  const { data: answers } = await supabase
    .from("quiz_answers")
    .select("*, questions!inner(id, type, content, options, correct_answer, explanation, difficulty)")
    .eq("session_id", sessionId)
    .order("answered_at", { ascending: true });

  // Get topic info
  const { data: topic } = await supabase
    .from("topics")
    .select("title, episodes!inner(title)")
    .eq("id", topicId)
    .single();

  return {
    session,
    answers: answers || [],
    topic,
    courseId,
  };
}

export default async function SessionReviewPage({
  params,
}: {
  params: Promise<{ id: string; topicId: string; sessionId: string }>;
}) {
  const { id: courseId, topicId, sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getSessionReviewData(sessionId, topicId, courseId, userId);
  if (!data) notFound();

  const { session, answers, topic } = data;
  const scorePct = Math.round(session.score_pct || 0);
  const isPassing = scorePct >= 70;
  const rtl = isRTL(topic?.title || "") || answers.some((a: any) => isRTL(a.questions?.content || ""));
  const debrief = session.debrief as {
    strengths: string[];
    gaps: string[];
    next_topic: string;
    reason: string;
  } | null;

  const completedAt = new Date(session.completed_at);
  const startedAt = new Date(session.started_at);
  const durationMs = completedAt.getTime() - startedAt.getTime();
  const durationMin = Math.round(durationMs / 60000);

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir={rtl ? "rtl" : "ltr"}>
      {/* Back link */}
      <Link
        href={`/dashboard/courses/${courseId}/topics/${topicId}`}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Topic
      </Link>

      {/* Session header */}
      <div className="rpg-card rounded-2xl p-5 sm:p-8">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">{isPassing ? "🎉" : "💪"}</div>
          <h1 className="text-xl font-extrabold text-white mb-1">
            Session Review
          </h1>
          <p className="text-sm text-slate-500">{topic?.title}</p>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Trophy
              className={cn(
                "w-5 h-5",
                isPassing ? "text-green-400" : "text-slate-500"
              )}
            />
            <span
              className={cn(
                "text-2xl font-extrabold",
                isPassing ? "text-green-400" : "text-white"
              )}
            >
              {scorePct}%
            </span>
          </div>

          <div className="w-px h-8 bg-slate-700/50" />

          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 font-bold">
              +{session.xp_earned} XP
            </span>
          </div>

          <div className="w-px h-8 bg-slate-700/50" />

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-400">
              {durationMin > 0 ? `${durationMin} min` : "< 1 min"}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 text-center mt-4">
          {completedAt.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* AI Debrief */}
      {debrief && (
        <div className="rpg-card rounded-2xl p-5 sm:p-6 space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            AI Study Coach
          </h2>

          {debrief.strengths?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold">
                What you understood well
              </p>
              <ul className="space-y-1.5">
                {debrief.strengths.map((s: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {debrief.gaps?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold">
                Needs more work
              </p>
              <ul className="space-y-1.5">
                {debrief.gaps.map((g: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Questions & Answers */}
      <div className="rpg-card rounded-2xl p-5 sm:p-6">
        <h2 className="font-bold text-white mb-5">
          Questions & Answers ({answers.length})
        </h2>

        <div className="space-y-4">
          {answers.map((answer: any, i: number) => {
            const q = answer.questions;
            const score = answer.ai_score ?? 0;
            const isCorrect = score >= 0.7;
            const isMcq = q.type === "mcq";

            return (
              <div
                key={answer.id}
                className={cn(
                  "rounded-xl border overflow-hidden",
                  isCorrect
                    ? "border-green-500/15"
                    : "border-red-500/15"
                )}
              >
                {/* Question header */}
                <div
                  className={cn(
                    "px-4 py-3 flex items-start gap-3",
                    isCorrect ? "bg-green-900/10" : "bg-red-900/10"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5",
                      isCorrect
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    )}
                  >
                    {isCorrect ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500 font-bold">
                        Q{i + 1}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-medium",
                          isMcq
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            : "bg-violet-500/10 border-violet-500/20 text-violet-400"
                        )}
                      >
                        {isMcq ? "MCQ" : "Open"}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-bold ml-auto",
                          isCorrect ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {isMcq
                          ? isCorrect
                            ? "Correct"
                            : "Wrong"
                          : `${Math.round(score * 100)}%`}
                      </span>
                    </div>
                    <MarkdownContent className="text-sm text-white font-semibold">
                      {q.content}
                    </MarkdownContent>
                  </div>
                </div>

                {/* Answer details */}
                <div className="px-4 py-3 space-y-3 bg-slate-900/30">
                  {/* MCQ options display */}
                  {isMcq && q.options && (
                    <div className="space-y-1.5">
                      {q.options.map((opt: string) => {
                        const isUserChoice = opt === answer.user_answer;
                        const isCorrectOpt = opt === q.correct_answer;
                        return (
                          <div
                            key={opt}
                            className={cn(
                              "px-3 py-2 rounded-lg text-xs border",
                              isCorrectOpt
                                ? "border-green-500/30 bg-green-500/10 text-green-300"
                                : isUserChoice && !isCorrectOpt
                                ? "border-red-500/30 bg-red-500/10 text-red-300 line-through opacity-70"
                                : "border-slate-700/30 bg-slate-800/20 text-slate-500"
                            )}
                          >
                            {isCorrectOpt && (
                              <CheckCircle className="w-3 h-3 inline mr-1.5" />
                            )}
                            {isUserChoice && !isCorrectOpt && (
                              <XCircle className="w-3 h-3 inline mr-1.5" />
                            )}
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Open answer display */}
                  {!isMcq && (
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                          Your Answer
                        </p>
                        <div className="text-sm text-slate-300 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30">
                          {answer.user_answer ? (
                            <MarkdownContent>{answer.user_answer}</MarkdownContent>
                          ) : (
                            <span className="italic text-slate-600">
                              No answer provided
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                          Model Answer
                        </p>
                        <div className="text-sm text-green-300/80 bg-green-900/10 rounded-lg px-3 py-2 border border-green-500/10">
                          <MarkdownContent>{q.correct_answer}</MarkdownContent>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feedback */}
                  {answer.ai_feedback && (
                    <div className="pt-2 border-t border-slate-700/20">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                        Feedback
                      </p>
                      <MarkdownContent className="text-xs text-slate-400">
                        {answer.ai_feedback}
                      </MarkdownContent>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Back to topic button */}
      <div className="text-center pb-4">
        <Link
          href={`/dashboard/courses/${courseId}/topics/${topicId}`}
          className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Topic
        </Link>
      </div>
    </div>
  );
}
