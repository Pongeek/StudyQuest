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
  Gem,
  Shield,
  Check,
  X,
  // Category icons for the locked-achievement grouping. Resolved by name
  // via CATEGORY_ICON_BY_NAME below so achievement-categories.ts can stay
  // React-free (just data).
  Flame,
  Swords,
  Target,
  Compass,
  Wand2,
  GraduationCap,
  ChevronDown,
} from "lucide-react";
import {
  calculateLevel,
  xpProgressInCurrentLevel,
  getLevelTitle,
} from "@/lib/xp";
import { cn } from "@/lib/utils";
import ProfileHeroCard from "@/components/profile/ProfileHeroCard";
import QuestPulse from "@/components/profile/QuestPulse";
import {
  groupByCategory,
  type CategoryMeta,
} from "@/lib/achievement-categories";

/** Resolves the category icon name (string) to its lucide component. */
const CATEGORY_ICON_BY_NAME: Record<CategoryMeta["iconName"], typeof Crown> = {
  Crown,
  Flame,
  Swords,
  Target,
  Compass,
  Wand2,
  GraduationCap,
};

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

      {/* ─── HERO — pixel-elegant HUD card (matches dashboard animations) ─── */}
      <ProfileHeroCard
        level={level}
        rankTitle={rankTitle}
        xpProgress={xpProgress}
        name={dbUser.name as string}
        email={(dbUser.email as string) || null}
        memberSinceLabel={
          memberSince
            ? memberSince.toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })
            : null
        }
        totalXp={totalXp}
        currentStreak={currentStreak}
        isHotStreak={isHotStreak}
        streakHint={streakHint}
        totalSessions={totalSessions || 0}
        earnedCount={earnedCount}
        totalAchievements={totalAchievements}
      />

      {/* ─── STUDY ACTIVITY HEATMAP ─── */}
      <section>
        <header className="flex items-center gap-3 mb-4 px-1">
          <div className="w-9 h-9 pixel-border bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-pixel text-[9px] tracking-wider text-indigo-400/90">
              ACTIVITY LOG
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
              Study Activity
            </h2>
          </div>
        </header>
        <QuestPulse data={heatmapData} currentStreak={currentStreak} />
      </section>

      {/* ─── ACHIEVEMENTS ─── */}
      <section>
        {/* Header with progress ring */}
        <div className="rpg-card rounded-2xl p-5 sm:p-6 mb-4 flex items-center gap-5 sm:gap-6 relative overflow-hidden">
          {/* Amber accent line — trophy stamp feel */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          {/* Pixel nails — amber, trophy stamp */}
          <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />

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
                <div className="font-pixel text-[9px] tracking-wider text-amber-400/75 mt-1.5">
                  OF {totalAchievements}
                </div>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-pixel text-[9px] tracking-wider text-amber-400/90 flex items-center gap-2 mb-2">
              <Crown className="w-3 h-3" />
              THE TROPHY CASE
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
            <div className="font-pixel text-[9px] tracking-wider text-amber-400/90 mb-3 flex items-center gap-2 px-1">
              <Sparkles className="w-3 h-3" />
              EARNED
              <span className="text-slate-700">&middot;</span>
              <span className="text-slate-500 tabular-nums">{earnedAchievementsList.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {earnedAchievementsList.map((ach: any) => (
                <TrophyCard key={ach.id} ach={ach} />
              ))}
            </div>
          </>
        )}

        {/* Locked — collapsed by category. Native <details> keeps this a
            server component; each category opens independently. Page height
            stays bounded even as the achievement set grows past 30. */}
        {lockedAchievementsList.length > 0 && (
          <>
            <div className="font-pixel text-[9px] tracking-wider text-slate-500 mb-3 flex items-center gap-2 px-1">
              <Lock className="w-3 h-3" />
              SEALED CHESTS
              <span className="text-slate-700">&middot;</span>
              <span className="text-slate-600 tabular-nums">{lockedAchievementsList.length}</span>
            </div>
            <div className="space-y-2">
              {groupByCategory(lockedAchievementsList).map((group) => {
                const Icon = CATEGORY_ICON_BY_NAME[group.meta.iconName];
                return (
                  <details
                    key={group.category}
                    className="group bg-slate-900/40 border border-white/[0.05] hover:border-white/[0.10] transition-colors"
                  >
                    <summary className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none list-none">
                      <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", group.meta.accent)} />
                      <span className={cn(
                        "font-pixel text-[9px] tracking-wider flex-1",
                        group.meta.accent
                      )}>
                        {group.meta.label.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-600 tabular-nums">
                        {group.items.length}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-600 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="grid sm:grid-cols-2 gap-3 px-3 pb-3 pt-1">
                      {group.items.map((ach: any) => (
                        <ChestCard key={ach.id} ach={ach} />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ─── MASTERED TOPICS ─── */}
      {topMasteries && topMasteries.length > 0 && (
        <section>
          <header className="flex items-center justify-between gap-3 mb-4 px-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 pixel-border bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Star className="w-4 h-4" />
              </div>
              <div>
                <div className="font-pixel text-[9px] tracking-wider text-emerald-400/90">
                  SKILL CONSTELLATIONS
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
            <div className="w-9 h-9 pixel-border bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
              <ScrollText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-pixel text-[9px] tracking-wider text-indigo-400/90">
                ADVENTURER&apos;S DIARY
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
                      <div className="font-pixel text-[9px] tracking-wider text-slate-500 mt-0.5">
                        SCORE
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 pixel-border bg-amber-500/10 text-amber-400 px-2.5 py-1">
                      <Zap className="w-3 h-3" />
                      <span className="font-pixel text-[10px] tracking-wider tabular-nums">
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
        {/* line-clamp-2 — long descriptions like "Proved your understanding
            by teaching a concept 5 times and passing" need two lines to
            read in full without being clipped. */}
        <div className="trophy-desc line-clamp-2">{ach.description}</div>
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
        {/* line-clamp-2 — see TrophyCard for the same rationale. */}
        <div className="chest-desc line-clamp-2">{ach.description}</div>
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

