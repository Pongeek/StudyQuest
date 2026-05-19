/**
 * Shared achievement helpers — check and award a single achievement by slug,
 * handling the idempotency guard and XP top-up in one place.
 *
 * Call sites pass the supabase service client so we don't create extra
 * instances per request.
 */
import { createServiceClient } from "@/lib/supabase/server";

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
