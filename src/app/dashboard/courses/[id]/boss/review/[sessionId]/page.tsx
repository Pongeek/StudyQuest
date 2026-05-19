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

async function getBossReviewData(
  sessionId: string,
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

  // Fetch the completed session (must belong to this user)
  const { data: session } = await supabase
    .from("boss_fight_sessions")
    .select("*, episodes!inner(id, title, course_id, courses!inner(user_id))")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .single();

  if (!session || !session.completed_at) return null;

  const episode = session.episodes as {
    id: string;
    title: string;
    course_id: string;
    courses: { user_id: string };
  };

  // Verify the episode's course matches the URL param and belongs to user
  if (episode.course_id !== courseId) return null;
  if (episode.courses.user_id !== dbUser.id) return null;

  // All answers with their questions
  const { data: answers } = await supabase
    .from("boss_fight_answers")
    .select(
      "*, questions:boss_fight_questions!inner(id, type, content, options, correct_answer, explanation, difficulty)"
    )
    .eq("session_id", sessionId)
    .order("answered_at", { ascending: true });

  return {
    session,
    answers: answers || [],
    episode,
    courseId,
  };
}

export default async function BossReviewPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: courseId, sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getBossReviewData(sessionId, courseId, userId);
  if (!data) notFound();

  const { session, answers, episode } = data;

  const scorePct = Math.round(session.score_pct || 0);
  const isPassing = !!session.passed || scorePct >= 70;
  const episodeTitle = episode.title as string;
  const episodeId = episode.id as string;

  const rtl =
    isRTL(episodeTitle) ||
    answers.some((a: any) => isRTL(a.questions?.content || ""));

  const debrief = session.debrief as {
    strengths?: string[];
    weaknesses?: string[];
    passed?: boolean;
    xpBreakdown?: Record<string, number>;
  } | null;

  const completedAt = new Date(session.completed_at);
  const startedAt = new Date(session.started_at);
  const durationMs = completedAt.getTime() - startedAt.getTime();
  const durationMin = Math.round(durationMs / 60000);

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir={rtl ? "rtl" : "ltr"}>
      {/* Back link */}
      <Link
        href={`/dashboard/courses/${courseId}/boss/prep/${episodeId}`}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Boss Prep
      </Link>

      {/* Session header card */}
      <div className="rpg-card rounded-2xl p-5 sm:p-8">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">{isPassing ? "🐉" : "💀"}</div>
          <h1 className="text-xl font-extrabold text-white mb-1">
            {isPassing ? "Boss Defeated" : "Boss Survives"}
          </h1>
          <p className="text-sm text-slate-500">{episodeTitle}</p>
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
      {debrief && (debrief.strengths?.length || debrief.weaknesses?.length) ? (
        <div className="rpg-card rounded-2xl p-5 sm:p-6 space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            AI Debrief
          </h2>

          {debrief.strengths && debrief.strengths.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold">
                Strengths
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

          {debrief.weaknesses && debrief.weaknesses.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold">
                Weaknesses
              </p>
              <ul className="space-y-1.5">
                {debrief.weaknesses.map((w: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Battle Report Q&A */}
      <div className="rpg-card rounded-2xl p-5 sm:p-6">
        <h2 className="font-bold text-white mb-5">
          Battle Report ({answers.length})
        </h2>

        <div className="space-y-4">
          {answers.map((answer: any, i: number) => {
            const q = answer.questions;
            const score = answer.ai_score ?? 0;
            const isCorrect = score >= 0.7;
            const isMcq = q.type === "mcq";
            const qRtl = isRTL(q.content || "");

            return (
              <div
                key={answer.id}
                className={cn(
                  "rounded-xl border overflow-hidden",
                  isCorrect ? "border-green-500/15" : "border-red-500/15"
                )}
                dir={qRtl ? "rtl" : "ltr"}
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
                  {/* MCQ options */}
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
                            <MarkdownContent className="inline">
                              {opt}
                            </MarkdownContent>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Open answer */}
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

      {/* Back to prep */}
      <div className="text-center pb-4">
        <Link
          href={`/dashboard/courses/${courseId}/boss/prep/${episodeId}`}
          className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Boss Prep
        </Link>
      </div>
    </div>
  );
}
