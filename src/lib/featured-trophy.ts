/**
 * Pure resolver for the profile's Featured Trophy — the one earned Achievement a
 * learner pins to their hero crest. A display choice, NOT a third identity tier
 * (Rank and Streak Title stay auto-derived). See CONTEXT.md → Featured Trophy.
 *
 * Defaults to the most-recently-earned trophy when nothing is pinned (or the
 * pinned id is stale), so the crest is never empty for a learner who has earned
 * anything.
 */

/**
 * @param featuredId          users.featured_achievement_id (nullable).
 * @param earnedMostRecentFirst earned achievements, newest first.
 * @returns the trophy to display, or null when nothing is earned.
 */
export function resolveFeaturedTrophy<T extends { id: string }>(
  featuredId: string | null,
  earnedMostRecentFirst: T[]
): T | null {
  if (featuredId) {
    const pinned = earnedMostRecentFirst.find((t) => t.id === featuredId);
    if (pinned) return pinned;
  }
  return earnedMostRecentFirst[0] ?? null;
}
