/**
 * Achievement category taxonomy.
 *
 * The profile page groups locked achievements into collapsed sections by
 * category so 30+ cards don't dominate the page. Categories are stable
 * (slug → category never changes silently) so the user's mental model of
 * "where does X live" survives migrations.
 *
 * To add a new achievement category: extend `CATEGORY_ORDER` + `CATEGORY_META`.
 * To re-categorize an achievement: edit `SLUG_TO_CATEGORY` only.
 * Unknown slugs fall into `quests` as a sensible default.
 */

export type AchievementCategory =
  | "mastery"
  | "streaks"
  | "combat"
  | "quests"
  | "wisdom"
  | "magic"
  | "teaching";

/** Render order for the locked section. Categories most directly tied to
 *  daily study (mastery, streaks) come first; flavor categories (magic,
 *  teaching) sit toward the bottom. */
export const CATEGORY_ORDER: AchievementCategory[] = [
  "mastery",
  "streaks",
  "combat",
  "quests",
  "wisdom",
  "magic",
  "teaching",
];

export interface CategoryMeta {
  label: string;
  /** Lucide icon name — imported in the profile page; centralized here as
   *  a string so this file stays free of React/lucide imports and can be
   *  consumed by any surface. */
  iconName:
    | "Crown"
    | "Flame"
    | "Swords"
    | "Target"
    | "Compass"
    | "Wand2"
    | "GraduationCap";
  /** Tailwind text color for the category header — kept in one place so the
   *  whole grouping has a coherent palette. */
  accent: string;
}

export const CATEGORY_META: Record<AchievementCategory, CategoryMeta> = {
  mastery:    { label: "Mastery",     iconName: "Crown",          accent: "text-amber-400" },
  streaks:    { label: "Streaks",     iconName: "Flame",          accent: "text-orange-400" },
  combat:     { label: "Combat",      iconName: "Swords",         accent: "text-red-400" },
  quests:     { label: "Quests",      iconName: "Target",         accent: "text-indigo-400" },
  wisdom:     { label: "Wisdom",      iconName: "Compass",        accent: "text-cyan-400" },
  magic:      { label: "Magic",       iconName: "Wand2",          accent: "text-purple-400" },
  teaching:   { label: "Teaching",    iconName: "GraduationCap",  accent: "text-emerald-400" },
};

/** Stable slug → category mapping. Update when adding new achievements.
 *  Slugs not in this map fall through to DEFAULT_CATEGORY. */
const SLUG_TO_CATEGORY: Record<string, AchievementCategory> = {
  // Mastery — high scores, full courses, master tiers
  perfectionist:      "mastery",
  scholar:            "mastery",
  master_mind:        "mastery",
  sage:               "mastery", // NEW (migration 016)

  // Streaks — consecutive-day cadence (study or review)
  on_fire:            "streaks",
  iron_will:          "streaks",
  consistent_scholar: "streaks",
  review_master:      "streaks",
  iron_legend:        "streaks", // NEW (016)
  iron_discipline:    "streaks", // NEW (016)

  // Combat — boss fights + grimoire demon-slaying
  boss_slayer:        "combat",
  unstoppable:        "combat",
  demon_slayer:       "combat",
  exorcist:           "combat",
  apex_predator:      "combat", // NEW (016)

  // Quests — quiz volume + exam practice + speed
  first_step:         "quests",
  speed_demon:        "quests",
  knowledge_seeker:   "quests",
  exam_ready:         "quests",
  centenarian:        "quests", // NEW (016)

  // Wisdom — the Scroll layer + first-course exploration
  bookworm:           "wisdom",
  dawn_scholar:       "wisdom",
  lore_keeper:        "wisdom",
  twilight_reader:    "wisdom", // NEW (016)

  // Magic — slot-machine / lucky / combo
  lucky_scholar:      "magic",
  perfect_day:        "magic",
  combo_breaker:      "magic",

  // Teaching — Feynman teach-back
  the_professor:      "teaching",
  first_lesson:       "teaching",
  eloquent_scholar:   "teaching",
};

const DEFAULT_CATEGORY: AchievementCategory = "quests";

export function categoryForSlug(slug: string): AchievementCategory {
  return SLUG_TO_CATEGORY[slug] ?? DEFAULT_CATEGORY;
}

/**
 * Group a list of achievements by category, returning a stable-order array
 * of `{ category, meta, items }` tuples for direct rendering. Categories
 * with zero items are omitted.
 */
export function groupByCategory<T extends { slug: string }>(
  achievements: T[]
): Array<{ category: AchievementCategory; meta: CategoryMeta; items: T[] }> {
  const buckets = new Map<AchievementCategory, T[]>();
  for (const a of achievements) {
    const cat = categoryForSlug(a.slug);
    let bucket = buckets.get(cat);
    if (!bucket) {
      bucket = [];
      buckets.set(cat, bucket);
    }
    bucket.push(a);
  }
  return CATEGORY_ORDER.filter((c) => buckets.has(c)).map((c) => ({
    category: c,
    meta: CATEGORY_META[c],
    items: buckets.get(c)!,
  }));
}
