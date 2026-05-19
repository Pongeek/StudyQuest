export const XP_REWARDS = {
  mcq_correct: 10,
  open_excellent: 25,    // score >= 0.9
  open_good: 18,         // score 0.7–0.89
  open_partial: 10,      // score 0.5–0.69
  first_topic_bonus: 20,
  perfect_quiz_multiplier: 1.5,
  streak_bonus_per_day: 0.1,  // +10% per streak day
  max_streak_bonus: 0.5,       // capped at +50%
  // Combo bonus — applied to the post-streak XP total based on max combo reached
  combo_min: 3,           // combos below this get no bonus
  combo_bonus_per_tier: 0.05, // +5% per tier above the minimum
  combo_max_tiers: 3,     // capped at 3 tiers → max +15%
  // Boss fight rewards (1.5x base rates)
  boss_mcq_correct: 15,
  boss_open_excellent: 38,
  boss_open_good: 27,
  boss_open_partial: 15,
  boss_completion_flat: 150,   // flat bonus for finishing a boss fight
  boss_perfect_multiplier: 2.0,
} as const;

export function calculateLevel(totalXp: number): number {
  // Level 1 starts at 0 XP, level N requires (N-1)² × 100 XP total
  let level = 1;
  while (totalXp >= Math.pow(level, 2) * 100) {
    level++;
  }
  return level;
}

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.pow(level - 1, 2) * 100;
}

export function xpForNextLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

export function xpProgressInCurrentLevel(totalXp: number): {
  current: number;
  needed: number;
  percentage: number;
} {
  const level = calculateLevel(totalXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForNextLevel(level);
  const current = totalXp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  return {
    current,
    needed,
    percentage: Math.floor((current / needed) * 100),
  };
}

export function calculateSessionXp(params: {
  answers: Array<{ type: "mcq" | "open"; score: number }>;
  streakDays: number;
  isFirstCompletion: boolean;
  maxCombo?: number;
}): { total: number; breakdown: Record<string, number> } {
  const { answers, streakDays, isFirstCompletion, maxCombo = 0 } = params;

  let baseXp = 0;
  const breakdown: Record<string, number> = {};
  let correctCount = 0;

  for (const answer of answers) {
    if (answer.type === "mcq") {
      if (answer.score === 1) {
        baseXp += XP_REWARDS.mcq_correct;
        correctCount++;
      }
    } else {
      if (answer.score >= 0.9) {
        baseXp += XP_REWARDS.open_excellent;
        correctCount++;
      } else if (answer.score >= 0.7) {
        baseXp += XP_REWARDS.open_good;
        correctCount++;
      } else if (answer.score >= 0.5) {
        baseXp += XP_REWARDS.open_partial;
      }
    }
  }

  breakdown.base = baseXp;

  const isPerfect = correctCount === answers.length && answers.length > 0;
  if (isPerfect) {
    const bonus = Math.floor(baseXp * (XP_REWARDS.perfect_quiz_multiplier - 1));
    breakdown.perfect_bonus = bonus;
    baseXp += bonus;
  }

  if (isFirstCompletion) {
    breakdown.first_completion = XP_REWARDS.first_topic_bonus;
    baseXp += XP_REWARDS.first_topic_bonus;
  }

  const streakMultiplier = Math.min(
    streakDays * XP_REWARDS.streak_bonus_per_day,
    XP_REWARDS.max_streak_bonus
  );
  if (streakMultiplier > 0) {
    const streakBonus = Math.floor(baseXp * streakMultiplier);
    breakdown.streak_bonus = streakBonus;
    baseXp += streakBonus;
  }

  // Combo bonus — rewards players who chained consecutive correct answers
  // Tiers: 3x = +5%, 4x = +10%, 5x+ = +15% (caps at 3 tiers)
  if (maxCombo >= XP_REWARDS.combo_min) {
    const tiers = Math.min(maxCombo - XP_REWARDS.combo_min + 1, XP_REWARDS.combo_max_tiers);
    const comboBonus = Math.floor(baseXp * tiers * XP_REWARDS.combo_bonus_per_tier);
    if (comboBonus > 0) {
      breakdown.combo_bonus = comboBonus;
      baseXp += comboBonus;
    }
  }

  return { total: baseXp, breakdown };
}

export function calculateBossFightXp(params: {
  answers: Array<{ type: "mcq" | "open"; score: number }>;
  streakDays: number;
  maxCombo?: number;
}): { total: number; breakdown: Record<string, number> } {
  const { answers, streakDays, maxCombo = 0 } = params;

  let baseXp = 0;
  const breakdown: Record<string, number> = {};
  let correctCount = 0;

  for (const answer of answers) {
    if (answer.type === "mcq") {
      if (answer.score === 1) {
        baseXp += XP_REWARDS.boss_mcq_correct;
        correctCount++;
      }
    } else {
      if (answer.score >= 0.9) {
        baseXp += XP_REWARDS.boss_open_excellent;
        correctCount++;
      } else if (answer.score >= 0.7) {
        baseXp += XP_REWARDS.boss_open_good;
        correctCount++;
      } else if (answer.score >= 0.5) {
        baseXp += XP_REWARDS.boss_open_partial;
      }
    }
  }

  breakdown.base = baseXp;

  // Boss completion flat bonus
  breakdown.boss_bonus = XP_REWARDS.boss_completion_flat;
  baseXp += XP_REWARDS.boss_completion_flat;

  // Perfect bonus (2x for boss fights!)
  const isPerfect = correctCount === answers.length && answers.length > 0;
  if (isPerfect) {
    const bonus = Math.floor(baseXp * (XP_REWARDS.boss_perfect_multiplier - 1));
    breakdown.perfect_bonus = bonus;
    baseXp += bonus;
  }

  // Streak bonus
  const streakMultiplier = Math.min(
    streakDays * XP_REWARDS.streak_bonus_per_day,
    XP_REWARDS.max_streak_bonus
  );
  if (streakMultiplier > 0) {
    const streakBonus = Math.floor(baseXp * streakMultiplier);
    breakdown.streak_bonus = streakBonus;
    baseXp += streakBonus;
  }

  // Combo bonus (same tiers as regular quiz — boss fights reward consistency too)
  if (maxCombo >= XP_REWARDS.combo_min) {
    const tiers = Math.min(maxCombo - XP_REWARDS.combo_min + 1, XP_REWARDS.combo_max_tiers);
    const comboBonus = Math.floor(baseXp * tiers * XP_REWARDS.combo_bonus_per_tier);
    if (comboBonus > 0) {
      breakdown.combo_bonus = comboBonus;
      baseXp += comboBonus;
    }
  }

  return { total: baseXp, breakdown };
}

export function calculateMasteryLevel(params: {
  sessions: number;
  lastScore: number;
  consecutiveGoodScores: number;
}): number {
  const { sessions, lastScore, consecutiveGoodScores } = params;
  if (sessions === 0) return 0;
  if (sessions >= 1 && lastScore < 0.7) return 1;
  if (lastScore >= 0.7) {
    if (consecutiveGoodScores >= 2 && lastScore >= 0.85) return 3;
    return 2;
  }
  return 1;
}

// Player class tiers — the RPG title shown alongside the user's overall level.
// Distinct from MASTERY_LABELS (which is per-topic).
export const LEVEL_TIERS = [
  { min: 1, max: 4, title: "Novice" },
  { min: 5, max: 9, title: "Apprentice" },
  { min: 10, max: 19, title: "Adept" },
  { min: 20, max: 34, title: "Expert" },
  { min: 35, max: 49, title: "Master" },
  { min: 50, max: Number.POSITIVE_INFINITY, title: "Sage" },
] as const;

export function getLevelTitle(level: number): string {
  return LEVEL_TIERS.find((t) => level >= t.min && level <= t.max)?.title ?? "Adventurer";
}

export const MASTERY_LABELS = ["Locked", "Novice", "Apprentice", "Adept", "Expert", "Master"] as const;
export const MASTERY_COLORS = [
  "text-gray-400",
  "text-slate-500",
  "text-green-500",
  "text-blue-500",
  "text-purple-500",
  "text-yellow-500",
] as const;
export const MASTERY_BG = [
  "bg-gray-100",
  "bg-slate-100",
  "bg-green-100",
  "bg-blue-100",
  "bg-purple-100",
  "bg-yellow-100",
] as const;
