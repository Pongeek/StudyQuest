"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isMuted as readMuted,
  setMuted as writeMuted,
  subscribeMute,
  playCorrect,
  playWrong,
  playXp,
  playCombo,
  playCritical,
  playLevelUp,
  playAchievement,
  playBossHit,
  playBossMiss,
  playBossDefeat,
  playReviewComplete,
} from "@/lib/sound";

/**
 * React hook for StudyQuest's audio engine.
 *
 * Exposes:
 *   - `play(name, ...args)` — fire-and-forget sound playback. No-op when muted
 *     OR when SSR (the engine guards both internally).
 *   - `muted` — current mute state, synced via custom event so multiple
 *     consumers stay in sync after a toggle.
 *   - `toggleMuted()` — flips and persists to localStorage.
 *
 * Safe to call `play()` from any event handler. The engine lazily creates
 * the AudioContext on first use (which is also the first user gesture).
 */
export function useSound() {
  // Initialize to the SSR default; the effect below hydrates the real value.
  const [muted, setMutedState] = useState<boolean>(() => readMuted());

  useEffect(() => {
    // Re-read once on mount (in case the SSR default disagrees with localStorage).
    setMutedState(readMuted());
    const unsub = subscribeMute(() => setMutedState(readMuted()));
    return unsub;
  }, []);

  const toggleMuted = useCallback(() => {
    writeMuted(!readMuted());
  }, []);

  const play = useCallback(
    (
      event:
        | "correct"
        | "wrong"
        | "xp"
        | "combo"
        | "critical"
        | "levelUp"
        | "achievement"
        | "bossHit"
        | "bossMiss"
        | "bossDefeat"
        | "reviewComplete",
      arg?: number | string
    ) => {
      switch (event) {
        case "correct":
          return playCorrect();
        case "wrong":
          return playWrong();
        case "xp":
          return playXp(
            (arg as "normal" | "big" | "critical" | undefined) ?? "normal"
          );
        case "combo":
          return playCombo(typeof arg === "number" ? arg : 2);
        case "critical":
          return playCritical();
        case "levelUp":
          return playLevelUp();
        case "achievement":
          return playAchievement();
        case "bossHit":
          return playBossHit();
        case "bossMiss":
          return playBossMiss();
        case "bossDefeat":
          return playBossDefeat();
        case "reviewComplete":
          return playReviewComplete();
      }
    },
    []
  );

  return { play, muted, toggleMuted };
}
