/**
 * Shared achievement helpers — check and award a single achievement by slug,
 * handling the idempotency guard and XP top-up in one place.
 *
 * Call sites pass the supabase service client so we don't create extra
 * instances per request.
 */
import { createServiceClient } from "@/lib/supabase/server";
import {
  evaluateAchievements,
  type AchievementFacts,
} from "@/lib/achievement-rules";

type SupabaseClient = ReturnType<typeof createServiceClient>;

export interface AwardedAchievement {
  slug: string;
  name: string;
  icon: string;
  description: string;
  xp_reward: number;
}

/**
 * Awards an achievement (by slug) to a user if not already earned.
 * Returns the awarded achievement or null if already earned / not found.
 * Does NOT update the user's total_xp — the caller should fold the
 * xp_reward into whatever XP update they are already performing.
 */
export async function awardAchievementIfNew(params: {
  userId: string;
  slug: string;
  supabase: SupabaseClient;
}): Promise<AwardedAchievement | null> {
  const { userId, slug, supabase } = params;

  const { data: ach } = await supabase
    .from("achievements")
    .select("id, slug, name, icon, description, xp_reward")
    .eq("slug", slug)
    .single();

  if (!ach) return null;

  const { data: alreadyEarned } = await supabase
    .from("user_achievements")
    .select("id")
    .eq("user_id", userId)
    .eq("achievement_id", ach.id)
    .single();

  if (alreadyEarned) return null;

  await supabase.from("user_achievements").insert({
    user_id: userId,
    achievement_id: ach.id,
  });

  return {
    slug: ach.slug,
    name: ach.name,
    icon: ach.icon,
    description: ach.description,
    xp_reward: ach.xp_reward ?? 0,
  };
}

/**
 * Awards multiple achievements at once, returning only newly granted ones.
 * Skips any already earned. Does NOT update total_xp.
 */
export async function awardAchievementsIfNew(params: {
  userId: string;
  slugs: string[];
  supabase: SupabaseClient;
}): Promise<AwardedAchievement[]> {
  const { userId, slugs, supabase } = params;
  if (slugs.length === 0) return [];

  const results = await Promise.all(
    slugs.map((slug) => awardAchievementIfNew({ userId, slug, supabase }))
  );

  return results.filter((r): r is AwardedAchievement => r !== null);
}

/**
 * The session-moment facts a completion route supplies. The global aggregate
 * counts in `AchievementFacts` are read by the shell itself, not the caller.
 */
type SessionMomentFacts = Pick<
  AchievementFacts,
  | "sessionType"
  | "scorePct"
  | "maxCombo"
  | "sessionDurationMs"
  | "newStreak"
  | "completedEpisodeIds"
>;

/** Whether every topic of each given episode is now complete (mastery ≥ 1). */
async function allEpisodesComplete(
  userId: string,
  episodeIds: string[],
  supabase: SupabaseClient,
): Promise<boolean> {
  if (episodeIds.length === 0) return false;
  for (const episodeId of episodeIds) {
    const { data: episodeTopics } = await supabase
      .from("topics")
      .select("id")
      .eq("episode_id", episodeId);
    if (!episodeTopics || episodeTopics.length === 0) return false;
    const topicIds = episodeTopics.map((t: { id: string }) => t.id);
    const { data: masteries } = await supabase
      .from("user_topic_mastery")
      .select("topic_id")
      .eq("user_id", userId)
      .in("topic_id", topicIds)
      .gte("mastery_level", 1);
    if ((masteries || []).length < topicIds.length) return false;
  }
  return true;
}

/**
 * Condition-based award path for session-completion routes. Reads the global
 * aggregate facts the pure evaluator needs, runs `evaluateAchievements`, then
 * awards atomically — batch-insert `user_achievements` + fold XP via the
 * atomic `increment_user_xp` RPC. Returns the newly granted achievements in the
 * same shape the routes already return as `newAchievements`.
 *
 * The global-count queries mirror the legacy inline checks exactly so quiz
 * awarding is unchanged; boss/review counts are read here too so cross-surface
 * conditions can fire on any surface (see issue #13, CONTEXT.md Achievements).
 */
export async function awardSessionAchievements(
  params: SessionMomentFacts & {
    userId: string;
    supabase: SupabaseClient;
    rng?: () => number;
  },
): Promise<AwardedAchievement[]> {
  const { userId, supabase, rng, ...moment } = params;

  const { data: achievementRows } = await supabase
    .from("achievements")
    .select("*");
  const { data: earned } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);
  const earnedIds = new Set<string>(
    (earned || []).map((e: { achievement_id: string }) => e.achievement_id),
  );

  const { count: quizSessionsCompleted } = await supabase
    .from("quiz_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  // Completed Exam Prep sessions live in their own exam_sessions table —
  // quiz_sessions has no session_type column, so the old
  // .eq("session_type","exam") errored and this count was silently always 0,
  // which kept the exam_sessions_completed achievement condition stuck at 0.
  const { count: examSessionsCompleted } = await supabase
    .from("exam_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  const { count: coursesUploaded } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: masterTopicCount } = await supabase
    .from("user_topic_mastery")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("mastery_level", 5);

  const { count: bossFightsCompleted } = await supabase
    .from("boss_fight_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("passed", true)
    .not("completed_at", "is", null);

  const { data: reviewRows } = await supabase
    .from("review_sessions")
    .select("completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null);
  const reviewDays = new Set(
    (reviewRows || []).map((r: { completed_at: string }) =>
      new Date(r.completed_at).toISOString().split("T")[0],
    ),
  ).size;

  const todayStr = new Date().toISOString().split("T")[0];
  const { count: perfectTodayCount } = await supabase
    .from("quiz_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("score_pct", 100)
    .gte("completed_at", `${todayStr}T00:00:00.000Z`);

  const allTopicsCompletedForCompletedEpisodes = await allEpisodesComplete(
    userId,
    moment.completedEpisodeIds,
    supabase,
  );

  const facts: AchievementFacts = {
    ...moment,
    quizSessionsCompleted: quizSessionsCompleted ?? 0,
    examSessionsCompleted: examSessionsCompleted ?? 0,
    coursesUploaded: coursesUploaded ?? 0,
    masterTopicCount: masterTopicCount ?? 0,
    bossFightsCompleted: bossFightsCompleted ?? 0,
    reviewDays,
    perfectTodayCount: perfectTodayCount ?? 0,
    allTopicsCompletedForCompletedEpisodes,
  };

  const qualifyingIds = evaluateAchievements(
    achievementRows || [],
    earnedIds,
    facts,
    rng,
  );
  if (qualifyingIds.length === 0) return [];

  await supabase
    .from("user_achievements")
    .insert(qualifyingIds.map((id) => ({ user_id: userId, achievement_id: id })));

  const awarded = (achievementRows || []).filter((a: { id: string }) =>
    qualifyingIds.includes(a.id),
  );

  const xpBonus = awarded.reduce(
    (sum: number, a: { xp_reward: number | null }) => sum + (a.xp_reward || 0),
    0,
  );
  if (xpBonus > 0) {
    await supabase.rpc("increment_user_xp", { p_user_id: userId, amount: xpBonus });
  }

  return awarded.map(
    (a: {
      slug: string;
      name: string;
      icon: string;
      description: string;
      xp_reward: number | null;
    }) => ({
      slug: a.slug,
      name: a.name,
      icon: a.icon,
      description: a.description,
      xp_reward: a.xp_reward ?? 0,
    }),
  );
}

/**
 * Adds XP rewards from newly granted achievements to the user's total_xp.
 * Call this after awardAchievementsIfNew so the bonus XP is always applied.
 */
export async function applyAchievementXP(params: {
  userId: string;
  achievements: AwardedAchievement[];
  currentTotalXp: number;
  supabase: SupabaseClient;
}): Promise<number> {
  const { userId, achievements, currentTotalXp, supabase } = params;
  const bonus = achievements.reduce((sum, a) => sum + (a.xp_reward ?? 0), 0);
  if (bonus === 0) return currentTotalXp;

  const newTotal = currentTotalXp + bonus;
  await supabase
    .from("users")
    .update({ total_xp: newTotal })
    .eq("id", userId);

  return newTotal;
}
