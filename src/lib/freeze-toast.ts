import { toast } from "sonner";

/**
 * Streak / freeze-token fields returned by every /complete route
 * (quiz, review, boss). Shared shape so engines can hand the whole
 * response to `showFreezeToasts` without further plumbing.
 */
export interface StreakResponseFields {
  newStreak?: number;
  streakAction?: "first-study" | "same-day" | "continued" | "frozen" | "reset";
  freezeTokensUsed?: number;
  freezeTokenEarned?: boolean;
  freezeTokensRemaining?: number;
  /**
   * Streak Title (B1) newly crossed this session — "Disciplined" … "Eternal",
   * or null/undefined when no milestone was reached. Set by the quiz / boss /
   * review complete routes via getEarnedStreakTitle.
   */
  streakTitleEarned?: string | null;
}

/**
 * Fires the burn / earn toasts when the engine's /complete response
 * carries the relevant fields. Safe to call with any response object —
 * unset fields no-op cleanly.
 *
 * Designed for QuizEngine / ReviewEngine / BossFightEngine completion
 * handlers; not used inline on per-question answers.
 */
export function showFreezeToasts(data: StreakResponseFields): void {
  const used = data.freezeTokensUsed ?? 0;
  if (used > 0) {
    const days = data.newStreak ?? 0;
    const msg =
      used === 1
        ? `❄ Streak Freeze used — your ${days}-day streak holds.`
        : `❄ ${used} Streak Freezes used — your ${days}-day streak holds.`;
    toast.success(msg, { duration: 6000 });
  }
  if (data.freezeTokenEarned) {
    toast.success(`❄ +1 Streak Freeze earned!`, { duration: 5000 });
  }
  if (data.streakTitleEarned) {
    toast.success(`🔥 Streak Title unlocked — ${data.streakTitleEarned}!`, {
      duration: 6000,
    });
  }
}
