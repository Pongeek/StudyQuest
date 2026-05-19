// src/app/dashboard/profile/page.tsx
// ─── StudyQuest Adventurer Profile ───────────────────────────────────────────
// Hero matches the dashboard pixel-elegant HUD (hud-level-frame, rank-chip,
// pixel-xp-bar, stat-label). Stat grid is unified into the hero card.
// Remains a React Server Component (no "use client").

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Trophy,
  Zap,
  BookOpen,
  Lock,
  Sparkles,
  Star,
  ArrowRight,
  ScrollText,
  Crown,
  Swords,
  Gem,
  Shield,
  Check,
  X,
} from "lucide-react";
import {
  calculateLevel,
  xpProgressInCurrentLevel,
  getLevelTitle,
} from "@/lib/xp";
import { cn } from "@/lib/utils";

export default async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) redirect("/dashboard");

  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("*, achievements(*)")
    .eq("user_id", dbUser.id)
    .order("earned_at", { ascending: false });

  const { data: allAchievements } = await supabase
    .from("achievements")
    .select("*")
    .order("condition_value", { ascending: true });

  const earnedIds = new Set(
    (userAchievements || []).map((ua: any) => ua.achievement_id)
  );

  const { data: topMasteries } = await supabase
    .from("user_topic_mastery")
    .select("*, topics(title)")
    .eq("user_id", dbUser.id)
    .gte("mastery_level", 2)
    .order("mastery_level", { ascending: false })
    .limit(10);

  const { count: totalSessions } = await supabase
    .from("quiz_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", dbUser.id)
    .not("completed_at", "is", null);

  // ── Activity heatmap — last 26 weeks ──────────────────────────────────────
  const heatmapSince = new Date(
    Date.now() - 182 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    { data: heatQuiz },
    { data: heatBoss },
    { data: heatReview },
    { data: heatFeynman },
  ] = await Promise.all([
    supabase
      .from("quiz_sessions")
      .select("completed_at")
      .eq("user_id", dbUser.id)
      .not("completed_at", "is", null)
      .gte("completed_at", heatmapSince),
    supabase
      .from("boss_fight_sessions")
      .select("completed_at")
      .eq("user_id", dbUser.id)
      .not("completed_at", "is", null)
      .gte("completed_at", heatmapSince),
    supabase
      .from("review_sessions")
      .select("completed_at")
      .eq("user_id", dbUser.id)
      .not("completed_at", "is", null)
      .gte("completed_at", heatmapSince),
    supabase
      .from("feynman_sessions")
      .select("completed_at")
      .eq("user_id", dbUser.id)
      .not("completed_at", "is", null)
      .gte("completed_at", heatmapSince),
  ]);

  const heatmapData: Record<string, number> = {};
  for (const row of [
    ...(heatQuiz ?? []),
    ...(heatBoss ?? []),
    ...(heatReview ?? []),
    ...(heatFeynman ?? []),
  ]) {
    if (!row.completed_at) continue;
    const day = (row.completed_at as string).slice(0, 10);
    heatmapData[day] = (heatmapData[day] ?? 0) + 1;
  }

  // ── Recent sessions ────────────────────────────────────────────────────────
  const { data: recentSessions } = await supabase
    .from("quiz_sessions")
    .select(
      "id, completed_at, score_pct, xp_earned, topic_id, topics!inner(title, episode_id, episodes!inner(course_id))"
    )
    .eq("user_id", dbUser.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(5);

  // ── Derived values ─────────────────────────────────────────────────────────
  const level = calculateLevel(dbUser.total_xp || 0);
  const rankTitle = getLevelTitle(level);
  const xpProgress = xpProgressInCurrentLevel(dbUser.total_xp || 0);
  const memberSince = dbUser.created_at ? new Date(dbUser.created_at) : null;
  const totalXp = (dbUser.total_xp as number) || 0;
  const currentStreak = (dbUser.current_streak as number) || 0;
  const longestStreak = (dbUser.longest_streak as number) || 0;
  const isHotStreak = currentStreak >= 7;
  const earnedCount = userAchievements?.length || 0;
  const totalAchievements = allAchievements?.length || 0;
  const achievementProgress =
    totalAchievements > 0 ? (earnedCount / totalAchievements) * 100 : 0;

  const earnedAchievementsList = (allAchievements || [])
    .filter((a: any) => earnedIds.has(a.id))
    .map((a: any) => {
      const ua = (userAchievements || []).find(
        (x: any) => x.achievement_id === a.id
      );
      return { ...a, earned_at: ua?.earned_at as string | undefined };
    })
    .sort((a: any, b: any) => {
      const aTime = a.earned_at ? new Date(a.earned_at).getTime() : 0;
      const bTime = b.earned_at ? new Date(b.earned_at).getTime() : 0;
      return bTime - aTime;
    });

  const lockedAchievementsList = (allAchievements || []).filter(
    (a: any) => !earnedIds.has(a.id)
  );

  function sessionHref(s: any): string {
    const courseId = s.topics?.episodes?.course_id;
    const topicId = s.topic_id;
    if (!courseId || !topicId) return "/dashboard";
    return `/dashboard/courses/${courseId}/topics/${topicId}/review/${s.id}`;
  }

  const streakHint =
    currentStreak === 0
      ? "Start today"
      : currentStreak >= longestStreak
      ? "Personal best"
      : `Best: ${longestStreak}d`;

  const masteryTiers: Array<{
    level: number;
    label: string;
    color: string;
    ring: string;
  }> = [
    { level: 5, label: "Master",     color: "#fbbf24", ring: "rgba(245,158,11,0.14)" },
    { level: 4, label: "Expert",     color: "#c084fc", ring: "rgba(168,85,247,0.14)" },
    { level: 3, label: "Adept",      color: "#60a5fa", ring: "rgba(59,130,246,0.14)" },
    { level: 2, label: "Apprentice", color: "#4ade80", ring: "rgba(34,197,94,0.14)" },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">

      {/* ─── HERO — pixel-elegant HUD card (matches dashboard) ─── */}
      <section className="rpg-card rounded-2xl overflow-hidden relative animate-slide-up">
        {/* Dot-matrix texture */}
        <div className="absolute inset-0 hud-hero-texture rounded-2xl" />

        {/* Header strip */}
        <div className="relative px-5 sm:px-7 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-white/[0.05]">
          <span className="stat-label text-amber-400/80 flex items-center gap-2">
            <Swords className="w-3.5 h-3.5" />
            Adventurer Profile
          </span>
          {memberSince && (
            <span className="text-[11px] text-slate-500 font-medium tracking-wide">
              Joined{" "}
              {memberSince.toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {/* Level frame + identity + XP bar */}
        <div className="relative px-5 sm:px-7 pt-5 pb-6 flex items-start gap-4">

          {/* Pixel level frame */}
          <div className="hud-level-frame" aria-label={`Level ${level}`}>
            <span className="hud-level-label">LVL</span>
            <span className="hud-level-number">{level}</span>
          </div>

          {/* Identity + XP */}
          <div className="flex-1 min-w-0 pt-1">
            {/* Rank chip */}
            <div className="rank-chip mb-2.5">
              <span aria-hidden="true" className="opacity-50">&#9670;</span>
              <span>{rankTitle.toUpperCase()}</span>
              <span aria-hidden="true" className="opacity-50">&#9670;</span>
            </div>

            {/* Name */}
            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate leading-tight tracking-tight">
              {dbUser.name || "Adventurer"}
            </h1>

            {/* Email or spacer */}
            {dbUser.email ? (
              <p className="text-slate-500 text-sm mt-1 mb-3 truncate">{dbUser.email}</p>
            ) : (
              <div className="mb-3" />
            )}

            {/* Pixel XP bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="stat-label text-amber-500/70">XP Progress</span>
                <span className="text-[11px] text-slate-400 tabular-nums font-medium">
                  {xpProgress.current.toLocaleString()} / {xpProgress.needed.toLocaleString()}
                </span>
              </div>
              <div
                className="pixel-xp-bar"
                role="progressbar"
                aria-valuenow={xpProgress.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`XP progress to level ${level + 1}: ${xpProgress.percentage}% complete`}
              >
                <div
                  className="pixel-xp-bar-fill"
                  style={{ width: `${xpProgress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="stat-label text-slate-600">LV.{level}</span>
                <span className="stat-label text-indigo-400/50">
                  {100 - xpProgress.percentage}% to next rank
                </span>
                <span className="stat-label text-slate-600">LV.{level + 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stat grid — Total XP · Streak · Sessions · Trophies */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border-t border-white/[0.06]">

          {/* Total XP */}
          <div className="bg-slate-950/95 px-5 py-4">
            <div className="stat-label text-amber-400 mb-2.5">Total XP</div>
            <div className="font-bold text-amber-400 text-2xl leading-none tracking-tight tabular-nums">
              {totalXp.toLocaleString()}
            </div>
            <div className="stat-label text-slate-500 mt-2">Battle Spoils</div>
          </div>

          {/* Streak */}
          <div className="bg-slate-950/95 px-5 py-4">
            <div className={cn(
              "stat-label mb-2.5",
              isHotStreak ? "text-orange-400" : currentStreak > 0 ? "text-orange-400" : "text-slate-400"
            )}>
              Streak
            </div>
            <div className={cn(
              "text-2xl font-bold leading-none tracking-tight",
              currentStreak > 0 ? (isHotStreak ? "text-orange-400 animate-fire-glow" : "text-orange-400") : "text-white"
            )}>
              {currentStreak > 0 ? currentStreak : "—"}
              {currentStreak > 0 && (
                <span className="text-sm font-medium text-slate-500 ml-0.5">d</span>
              )}
            </div>
            <div className="stat-label text-slate-500 mt-2">{streakHint}</div>
          </div>

          {/* Sessions */}
          <div className="bg-slate-950/95 px-5 py-4">
            <div className="stat-label text-slate-400 mb-2.5">Sessions</div>
            <div className="font-bold text-white text-2xl leading-none tracking-tight tabular-nums">
              {totalSessions || 0}
            </div>
            <div className="stat-label text-slate-500 mt-2">Quests Logged</div>
          </div>

          {/* Trophies */}
          <div className="bg-slate-950/95 px-5 py-4">
            <div className="stat-label text-purple-400 mb-2.5">Trophies</div>
            <div className="font-bold text-white text-2xl leading-none tracking-tight tabular-nums">
              {earnedCount}
              <span className="text-slate-600 text-lg font-normal">/{totalAchievements}</span>
            </div>
            <div className="stat-label text-slate-500 mt-2">Hall of Honor</div>
          </div>

        </div>
      </section>

      {/* ─── STUDY ACTIVITY HEATMAP ─── */}
      <section>
        <header className="flex items-center gap-3 mb-4 px-1">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.20)",
            }}
          >
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] font-bold text-indigo-400/80">
              Activity Log
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
              Study Activity
            </h2>
          </div>
        </header>
        <StudyHeatmap data={heatmapData} />
      </section>

      {/* ─── ACHIEVEMENTS ─── */}
      <section>
        {/* Header with progress ring */}
        <div className="rpg-card rounded-2xl p-5 sm:p-6 mb-4 flex items-center gap-5 sm:gap-6">
          <div className="achievement-ring-wrap">
            <svg className="achievement-ring-svg" viewBox="0 0 132 132">
              <defs>
                <linearGradient id="sqRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <circle cx="66" cy="66" r="56" strokeWidth="7" fill="none" className="achievement-ring-bg" />
              <circle
                cx="66" cy="66" r="56" strokeWidth="7" fill="none"
                className="achievement-ring-fill"
                strokeDasharray={2 * Math.PI * 56}
                strokeDashoffset={2 * Math.PI * 56 * (1 - achievementProgress / 100)}
              />
            </svg>
            <div className="achievement-ring-center">
              <div>
                <div className="text-3xl font-extrabold text-white tabular-nums tracking-tight leading-none">
                  {earnedCount}
                </div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-amber-400/75 mt-1.5">
                  of {totalAchievements}
                </div>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.28em] font-bold text-amber-400/80 flex items-center gap-2 mb-2">
              <Crown className="w-3.5 h-3.5" />
              The Trophy Case
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Honors &amp; Relics
            </h2>
            <p className="text-sm text-slate-400 mt-1.5">
              {earnedCount > 0
                ? `${earnedCount} of ${totalAchievements} relics claimed. ${totalAchievements - earnedCount} remain sealed.`
                : "Your trophy case awaits its first relic."}
            </p>
          </div>
        </div>

        {/* Earned */}
        {earnedAchievementsList.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-[0.28em] font-bold text-amber-400/80 mb-3 flex items-center gap-2 px-1">
              <Sparkles className="w-3 h-3" />
              Earned
              <span className="text-slate-700">·</span>
              <span className="text-slate-500 tabular-nums">{earnedAchievementsList.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {earnedAchievementsList.map((ach: any) => (
                <TrophyCard key={ach.id} ach={ach} />
              ))}
            </div>
          </>
        )}

        {/* Locked */}
        {lockedAchievementsList.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-[0.28em] font-bold text-slate-500 mb-3 flex items-center gap-2 px-1">
              <Lock className="w-3 h-3" />
              Sealed Chests
              <span className="text-slate-700">·</span>
              <span className="text-slate-600 tabular-nums">{lockedAchievementsList.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {lockedAchievementsList.map((ach: any) => (
                <ChestCard key={ach.id} ach={ach} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ─── MASTERED TOPICS ─── */}
      {topMasteries && topMasteries.length > 0 && (
        <section>
          <header className="flex items-center justify-between gap-3 mb-4 px-1">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}
              >
                <Star className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] font-bold text-emerald-400/80">
                  Skill Constellations
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                  Mastered Topics
                </h2>
              </div>
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
              {topMasteries.length} topic{topMasteries.length === 1 ? "" : "s"} bound
            </div>
          </header>
          <div>
            {masteryTiers.map((tier) => {
              const topics = (topMasteries || []).filter(
                (m: any) => m.mastery_level === tier.level
              );
              if (topics.length === 0) return null;
              const TierIcon =
                tier.level >= 5 ? Crown :
                tier.level >= 4 ? Gem :
                tier.level >= 3 ? Shield : Star;
              return (
                <div key={tier.level} className="tier-row" style={{ borderColor: tier.ring }}>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5" style={{ color: tier.color }}>
                      <TierIcon className="w-4 h-4" />
                      <span className="font-bold text-base tracking-tight">{tier.label}</span>
                    </div>
                    <div className="tier-stars" aria-label={`${tier.level} of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg
                          key={i}
                          viewBox="0 0 20 20"
                          className="tier-star"
                          fill={i <= tier.level ? tier.color : "rgba(255,255,255,0.07)"}
                          style={i <= tier.level ? { filter: `drop-shadow(0 0 2px ${tier.color}66)` } : undefined}
                        >
                          <polygon points="10,1 12.6,7 19,7.6 14,12 15.5,19 10,15.5 4.5,19 6,12 1,7.6 7.4,7" />
                        </svg>
                      ))}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500 mt-1.5 tabular-nums">
                      {topics.length} topic{topics.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((m: any) => (
                      <span key={m.id} className="topic-node">
                        <span
                          className="topic-node-dot"
                          style={{ background: tier.color, color: tier.color }}
                        />
                        <span className="truncate max-w-[260px]">{m.topics?.title}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── RECENT ACTIVITY ─── */}
      <section>
        <header className="flex items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.22)" }}
            >
              <ScrollText className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] font-bold text-indigo-400/80">
                Adventurer&apos;s Diary
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                Recent Quests
              </h2>
            </div>
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            {recentSessions && recentSessions.length > 0 ? "Last 5 entries" : "No entries yet"}
          </div>
        </header>

        {recentSessions && recentSessions.length > 0 ? (
          <div className="quest-log-rail">
            {recentSessions.map((s: any) => {
              const score = Math.round((s.score_pct as number) || 0);
              const passing = score >= 70;
              const failing = score < 50;
              const completedAt = new Date(s.completed_at as string);
              const month = completedAt.toLocaleDateString(undefined, { month: "short" });
              const day = completedAt.getDate();
              const topicTitle = (s.topics as { title?: string } | null)?.title ?? "Topic";

              return (
                <Link
                  key={s.id}
                  href={sessionHref(s)}
                  className={cn("quest-row", passing && "passing", failing && "failing")}
                >
                  <span className="quest-stamp" aria-hidden>
                    <span className="quest-stamp-month">{month}</span>
                    <span className="quest-stamp-day">{day}</span>
                  </span>
                  <div className="min-w-0 flex flex-col gap-0.5 pl-1">
                    <span className="text-[14.5px] text-white font-semibold truncate leading-snug">
                      {topicTitle}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {completedAt.toLocaleDateString(undefined, { weekday: "short" })}{" "}
                      ·{" "}
                      {completedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pr-1 shrink-0">
                    <div className="text-right">
                      <div className="score-runic">
                        {passing && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                        {failing && <X className="w-3.5 h-3.5" strokeWidth={3} />}
                        <span>{score}%</span>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-500 mt-0.5">
                        Score
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-[12px] font-bold text-amber-300 tabular-nums">
                        +{s.xp_earned ?? 0}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rpg-card rounded-xl p-8 text-center">
            <BookOpen className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-400">The log is empty</p>
            <p className="text-xs text-slate-500 mt-1">
              Take a quiz on any topic to begin your chronicle.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── TrophyCard ───────────────────────────────────────────────────────────────

function TrophyCard({
  ach,
}: {
  ach: {
    id: string;
    name: string;
    description: string;
    icon: string;
    xp_reward: number;
    earned_at?: string;
  };
}) {
  return (
    <div className="trophy-card">
      <div className="trophy-icon-stage">
        <div className="trophy-icon-aura" aria-hidden />
        <div className="trophy-icon-tile">
          <span>{ach.icon}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="trophy-name truncate">{ach.name}</div>
        <div className="trophy-desc line-clamp-1">{ach.description}</div>
        <div className="trophy-meta">
          <span className="inline-flex items-center gap-1">
            <Zap className="w-3 h-3" />
            +{ach.xp_reward} XP
          </span>
          {ach.earned_at && (
            <>
              <span className="text-amber-500/35">&#9670;</span>
              <span className="text-amber-100/60 normal-case tracking-normal font-semibold">
                {new Date(ach.earned_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ChestCard ────────────────────────────────────────────────────────────────

function ChestCard({
  ach,
}: {
  ach: { id: string; name: string; description: string; xp_reward: number };
}) {
  return (
    <div className="chest-card">
      <div className="chest-icon">
        <div className="chest-lock">
          <Lock className="w-3 h-3 text-stone-400" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="chest-name truncate">{ach.name}</div>
        <div className="chest-desc line-clamp-1">{ach.description}</div>
        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-stone-500 uppercase tracking-[0.08em]">
          <Zap className="w-3 h-3" />
          +{ach.xp_reward} XP
          <span className="text-stone-700">·</span>
          <span className="text-stone-400 normal-case tracking-normal font-semibold">Sealed</span>
        </div>
      </div>
    </div>
  );
}

// ─── Study Heatmap ────────────────────────────────────────────────────────────

const HEATMAP_WEEKS = 26;

function StudyHeatmap({ data }: { data: Record<string, number> }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay());

  const columns: Array<Array<{ dateStr: string; count: number; isFuture: boolean }>> = [];
  const cursor = new Date(start);

  while (columns.length < HEATMAP_WEEKS + 1) {
    const week: Array<{ dateStr: string; count: number; isFuture: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      week.push({ dateStr, count: data[dateStr] ?? 0, isFuture: cursor > today });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(week);
  }

  const visibleColumns = columns.slice(-HEATMAP_WEEKS);

  function cellColor(count: number, isFuture: boolean): string {
    if (isFuture) return "bg-white/[0.02]";
    if (count === 0) return "bg-white/[0.06]";
    if (count === 1) return "bg-indigo-900/80";
    if (count <= 3) return "bg-indigo-700/80";
    if (count <= 6) return "bg-indigo-500";
    return "bg-indigo-400";
  }

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthLabels: (string | null)[] = visibleColumns.map((col, i) => {
    const m = new Date(col[0].dateStr + "T12:00:00").toLocaleDateString(undefined, { month: "short" });
    if (i === 0) return m;
    const prev = new Date(visibleColumns[i - 1][0].dateStr + "T12:00:00").toLocaleDateString(undefined, { month: "short" });
    return m !== prev ? m : null;
  });

  const totalActiveDays = Object.keys(data).length;
  const totalSessionCount = Object.values(data).reduce((s, n) => s + n, 0);
  const bestDay = Object.values(data).reduce((m, n) => Math.max(m, n), 0);

  const LEGEND = ["bg-white/[0.06]", "bg-indigo-900/80", "bg-indigo-700/80", "bg-indigo-500", "bg-indigo-400"];

  return (
    <div className="rpg-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4 text-xs text-slate-500 font-medium flex-wrap">
        <span>
          <span className="text-white font-bold tabular-nums">{totalActiveDays}</span>{" "}
          active day{totalActiveDays !== 1 ? "s" : ""}
        </span>
        <span className="text-slate-700">·</span>
        <span>
          <span className="text-white font-bold tabular-nums">{totalSessionCount}</span>{" "}
          session{totalSessionCount !== 1 ? "s" : ""}
        </span>
        {bestDay > 0 && (
          <>
            <span className="text-slate-700">·</span>
            <span>
              <span className="text-indigo-400 font-bold tabular-nums">{bestDay}</span> best day
            </span>
          </>
        )}
        <span className="text-slate-700">·</span>
        <span>last 6 months</span>
      </div>

      <div className="flex gap-[3px] mb-1.5 pl-8">
        {visibleColumns.map((_, i) => (
          <div
            key={i}
            className="flex-1 min-w-0 text-[9px] text-slate-500 font-medium overflow-visible whitespace-nowrap"
          >
            {monthLabels[i] ?? ""}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-[3px]">
        {DAY_LABELS.map((label, rowIdx) => (
          <div key={label} className="flex items-center gap-[3px]">
            <span className="w-8 text-right pr-1.5 text-[9px] text-slate-600 font-medium shrink-0 leading-none">
              {[1, 3, 5].includes(rowIdx) ? label : ""}
            </span>
            {visibleColumns.map((col, colIdx) => {
              const cell = col[rowIdx];
              return (
                <div
                  key={colIdx}
                  title={
                    cell.isFuture ? "" :
                    cell.count === 0 ? cell.dateStr :
                    `${cell.dateStr} — ${cell.count} session${cell.count !== 1 ? "s" : ""}`
                  }
                  className={cn(
                    "flex-1 aspect-square rounded-[2px] transition-colors duration-150 min-w-0",
                    cellColor(cell.count, cell.isFuture),
                    !cell.isFuture && cell.count > 0 && "hover:ring-1 hover:ring-indigo-400/50 cursor-default"
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-3 pl-8">
        <span className="text-[9px] text-slate-600">Less</span>
        {LEGEND.map((cls, i) => (
          <div key={i} className={cn("w-3 h-3 rounded-[2px]", cls)} />
        ))}
        <span className="text-[9px] text-slate-600">More</span>
      </div>
    </div>
  );
}
