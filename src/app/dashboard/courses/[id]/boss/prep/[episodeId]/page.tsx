import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ArrowLeft, Skull, Swords, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import BossPrepActions from "@/components/quiz/BossPrepActions";

function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

async function getBossPrepData(episodeId: string, courseId: string, clerkId: string) {
  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (!dbUser) return null;

  // Verify the episode belongs to a course owned by this user
  const { data: episode } = await supabase
    .from("episodes")
    .select("id, title, courses!inner(id, user_id, title)")
    .eq("id", episodeId)
    .single();

  if (!episode || (episode.courses as any).user_id !== dbUser.id) return null;
  if ((episode.courses as any).id !== courseId) return null;

  // Fetch topics in this episode
  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, difficulty")
    .eq("episode_id", episodeId)
    .order("order_index");

  // Count cached boss questions
  const { count: questionCount } = await supabase
    .from("boss_fight_questions")
    .select("id", { count: "exact", head: true })
    .eq("episode_id", episodeId);

  // Last 5 completed sessions
  const { data: recentSessions } = await supabase
    .from("boss_fight_sessions")
    .select("id, completed_at, score_pct, xp_earned, passed")
    .eq("user_id", dbUser.id)
    .eq("episode_id", episodeId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(5);

  const sessions = recentSessions || [];
  const bestScore =
    sessions.length > 0
      ? Math.max(...sessions.map((s: any) => s.score_pct ?? 0))
      : null;

  return {
    episode,
    topics: topics || [],
    hasExistingQuestions: (questionCount ?? 0) > 0,
    questionCount: questionCount ?? 0,
    recentSessions: sessions,
    bestScore,
  };
}

export default async function BossPrepPage({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id: courseId, episodeId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getBossPrepData(episodeId, courseId, userId);
  if (!data) notFound();

  const { episode, topics, hasExistingQuestions, questionCount, recentSessions, bestScore } =
    data;

  const episodeTitle = episode.title as string;
  const rtl = isRTL(episodeTitle);
  const bestScoreDisplay =
    bestScore !== null ? `${Math.round(bestScore)}%` : "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir={rtl ? "rtl" : "ltr"}>
      {/* Back link */}
      <Link
        href={`/dashboard/courses/${courseId}`}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Course
      </Link>

      {/* Boss preview card */}
      <div className="rpg-card-gold rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-8">
          {/* Tier ribbon */}
          <p className="text-[11px] uppercase tracking-wider font-medium text-amber-400/80 mb-4">
            Episode Boss
          </p>

          <div className="flex items-start gap-4 mb-6">
            {/* Icon tile */}
            <div className="w-12 h-12 bg-white/[0.04] border border-white/[0.07] rounded-xl flex items-center justify-center flex-shrink-0">
              <Skull className="w-6 h-6 text-red-400" />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {episodeTitle}
              </h1>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                The {episodeTitle} boss draws from every topic in this episode.
                Practice mode if you want to retry the same trials, or generate
                fresh ones for a different challenge.
              </p>
            </div>
          </div>

          {/* Topics covered */}
          {topics.length > 0 && (
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-2">
                Topics Covered
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topics.map((t: any) => (
                  <span
                    key={t.id}
                    className="text-xs bg-white/[0.04] border border-white/[0.07] text-slate-400 px-2.5 py-1 rounded-full"
                  >
                    {t.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats strip */}
          <div className="grid grid-cols-3 divide-x divide-white/[0.07] border border-white/[0.07] rounded-xl overflow-hidden">
            <div className="px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-1">
                Trials
              </p>
              <p className="text-lg font-bold text-white tabular-nums">
                {questionCount > 0 ? questionCount : "—"}
              </p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-1">
                Best Score
              </p>
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  bestScore !== null && bestScore >= 70
                    ? "text-green-400"
                    : "text-white"
                )}
              >
                {bestScoreDisplay}
              </p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-1">
                Attempts
              </p>
              <p className="text-lg font-bold text-white tabular-nums">
                {recentSessions.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action card */}
      <div className="rpg-card rounded-2xl p-5 sm:p-6">
        <div className="w-12 h-12 bg-white/[0.04] border border-white/[0.07] rounded-xl flex items-center justify-center mx-auto mb-4">
          <Swords className="w-6 h-6 text-indigo-400" />
        </div>
        <h2 className="text-lg font-bold text-white text-center mb-1">
          Ready for Battle?
        </h2>
        <p className="text-slate-400 text-sm text-center mb-6">
          {hasExistingQuestions
            ? "Pick your mode — retry the same trials or face an entirely fresh set."
            : "No questions cached yet. Your first attempt will generate them now."}
        </p>
        <BossPrepActions
          episodeId={episodeId}
          courseId={courseId}
          hasExistingQuestions={hasExistingQuestions}
        />
      </div>

      {/* Recent sessions card */}
      <div className="rpg-card rounded-2xl p-5 sm:p-6">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Swords className="w-4 h-4 text-indigo-400" />
          Recent Sessions
        </h2>

        {recentSessions.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No completed boss fights yet. Take your first swing.
          </p>
        ) : (
          <div className="space-y-2">
            {recentSessions.map((session: any) => {
              const score = Math.round(session.score_pct ?? 0);
              const isPassing = score >= 70;
              return (
                <Link
                  key={session.id}
                  href={`/dashboard/courses/${courseId}/boss/review/${session.id}`}
                  className={cn(
                    "flex items-center justify-between text-sm rounded-xl px-4 py-3 transition-all duration-200 group",
                    "bg-slate-800/30 hover:bg-slate-800/50 border border-transparent hover:border-indigo-500/15"
                  )}
                >
                  <span className="text-slate-500 group-hover:text-slate-400 transition-colors text-xs font-medium">
                    {new Date(session.completed_at).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                  <span
                    className={cn(
                      "font-extrabold tabular-nums",
                      isPassing ? "text-green-400" : "text-white"
                    )}
                  >
                    {score}%
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/15 rounded-full px-2 py-0.5">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-400 text-xs font-bold">
                        +{session.xp_earned}
                      </span>
                    </div>
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-700 group-hover:text-indigo-400 transition-all duration-200 rotate-180 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
