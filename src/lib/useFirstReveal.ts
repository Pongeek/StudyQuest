"use client";

// ─── useFirstReveal ─────────────────────────────────────────────────────────
// Shared first-reveal-only animation guard behind the profile's tab-in entrance
// animations (CountUp, ProgressFill). A module-level Set keyed by `animKey`
// records which surfaces have already played, surviving the unmount/remount
// that happens when an inactive profile tab panel is hidden — so re-entering a
// tab doesn't replay the entrance. Reduced-motion treats every surface as
// already-settled (jump straight to the final value, no animation).

import { useCallback } from "react";
import { useReducedMotion } from "framer-motion";

const revealedKeys = new Set<string>();

export interface FirstReveal {
  /** True when the user prefers reduced motion. */
  reduce: boolean;
  /**
   * True if this surface is already settled — reduced-motion, or it has played
   * its entrance earlier this page session. Render the final value when true,
   * the 0 start when false. Reads the live Set, so a prop change *after* the
   * first play takes the instant path (no replay).
   */
  settled: () => boolean;
  /** Record that this surface has now revealed (no-op under reduced motion). */
  markRevealed: () => void;
}

/**
 * Tracks whether `animKey`'s entrance animation should play. Call `settled()`
 * in the lazy initial state and at the top of the entrance effect; call
 * `markRevealed()` when the animation starts. The returned callbacks are stable
 * per (animKey, reduce), so they can sit in effect dependency arrays.
 */
export function useFirstReveal(animKey: string): FirstReveal {
  const reduce = useReducedMotion() ?? false;

  const settled = useCallback(
    () => reduce || revealedKeys.has(animKey),
    [reduce, animKey]
  );

  const markRevealed = useCallback(() => {
    if (!reduce) revealedKeys.add(animKey);
  }, [reduce, animKey]);

  return { reduce, settled, markRevealed };
}
