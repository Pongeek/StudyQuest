"use client";

// ─── useBossFightDemo ────────────────────────────────────────────────────────
// Shared client-only hook for the landing-page "engage boss" mini-game.
// Tracks boss HP (0–100), spawns short-lived damage events for floating
// popups, and exposes a reset for replay. Used by both BossVisual (in
// LandingStory) and BossMock (in LandingProductMockups) so each card runs
// its own instance independently.

import { useCallback, useRef, useState } from "react";

export interface DamageEvent {
  /** Unique id used as React key + cleanup target */
  id: number;
  /** HP amount removed by this hit */
  amount: number;
  /** Horizontal offset (px) so multiple popups don't stack on top of each other */
  xOffset: number;
}

const DAMAGE_MIN = 8;
const DAMAGE_MAX = 20;
const DAMAGE_LIFETIME_MS = 1100;

export interface BossFightDemo {
  hp: number;
  isVictory: boolean;
  damageEvents: DamageEvent[];
  handleHit: () => void;
  reset: () => void;
}

export function useBossFightDemo(): BossFightDemo {
  const [hp, setHp] = useState(100);
  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([]);
  const idRef = useRef(0);

  const isVictory = hp <= 0;

  const handleHit = useCallback(() => {
    setHp((prev) => {
      if (prev <= 0) return prev; // already defeated
      const amount = Math.floor(
        Math.random() * (DAMAGE_MAX - DAMAGE_MIN + 1) + DAMAGE_MIN
      );
      idRef.current += 1;
      const id = idRef.current;
      // X offset randomized in ±28px range — keeps consecutive popups from stacking
      const xOffset = Math.floor(Math.random() * 56) - 28;
      setDamageEvents((events) => [...events, { id, amount, xOffset }]);
      // Schedule cleanup of this damage event after its animation completes
      setTimeout(() => {
        setDamageEvents((events) => events.filter((e) => e.id !== id));
      }, DAMAGE_LIFETIME_MS);
      return Math.max(0, prev - amount);
    });
  }, []);

  const reset = useCallback(() => {
    setHp(100);
    setDamageEvents([]);
  }, []);

  return { hp, isVictory, damageEvents, handleHit, reset };
}
