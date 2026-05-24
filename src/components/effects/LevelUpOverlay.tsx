"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "./Confetti";
import TierLevelFrame from "@/components/gamification/TierLevelFrame";
import { getLevelTitle } from "@/lib/xp";
import {
  getLevelTierVisuals,
  isTierUp,
  type TierName,
} from "@/lib/level-tier";
import { useSound } from "@/lib/useSound";

export interface LevelUpOverlayProps {
  show: boolean;
  fromLevel: number;
  toLevel: number;
  /** Provided when the player crossed a LEVEL_TIERS boundary */
  newRank?: string;
  onClose: () => void;
}

/** Burst radial-gradient color per new tier, used on the rank-up flash. */
const BURST_COLOR_BY_TIER: Record<TierName, string> = {
  novice: "rgba(148,163,184,0.35)",
  apprentice: "rgba(245,158,11,0.40)",
  adept: "rgba(56,189,248,0.40)",
  expert: "rgba(234,179,8,0.40)",
  master: "rgba(168,85,247,0.42)",
  sage: "rgba(245,158,11,0.42)",
};

export default function LevelUpOverlay({
  show,
  fromLevel,
  toLevel,
  newRank,
  onClose,
}: LevelUpOverlayProps) {
  // Escape key to dismiss
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && show) onClose();
    },
    [show, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Play the level-up fanfare when the overlay opens. No-op if muted.
  const { play } = useSound();
  useEffect(() => {
    if (show) play("levelUp");
  }, [show, play]);

  // Tier-crossing = bigger celebration moment. Regular level-ups inside
  // the same tier still get the overlay but skip the "RANK UP" beat,
  // burst, and tier banner.
  const rankUp = isTierUp(fromLevel, toLevel);
  const newTierVisuals = getLevelTierVisuals(toLevel);
  const newTierTitle = getLevelTitle(toLevel);
  const displayRank = newRank ?? (rankUp ? newTierTitle : undefined);
  const burstColor = BURST_COLOR_BY_TIER[newTierVisuals.tier];

  return (
    <>
      {show && <Confetti trigger={1} count={150} duration={4000} />}

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
            aria-label={rankUp ? "Rank Up!" : "Level Up!"}
          >
            {/* Card */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="relative mx-4 w-full max-w-sm"
            >
              {/* Warm glow behind card — recolored to the new tier on rank up
                  so the ambient color of the moment matches the new rank. */}
              <div
                className="absolute -inset-8 rounded-full blur-3xl pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${burstColor} 0%, transparent 70%)`,
                }}
                aria-hidden
              />

              <div className="relative rpg-card-gold rounded-2xl p-8 sm:p-10 text-center overflow-hidden">
                {/* Pixel scanlines overlay — subtle texture */}
                <div
                  className="absolute inset-0 pixel-scanlines opacity-30 pointer-events-none"
                  aria-hidden
                />

                {/* Headline — swaps to RANK UP on tier crossing */}
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.35 }}
                  className="mb-6"
                >
                  <p
                    className="font-pixel text-amber-300 leading-snug"
                    style={{ fontSize: "clamp(18px, 5vw, 28px)" }}
                  >
                    {rankUp ? "RANK UP!" : "LEVEL UP!"}
                  </p>
                </motion.div>

                {/* The reveal — new tier-aware level frame. On rank-up,
                    a scale-burst flashes behind the frame for ~600ms in
                    the new tier accent color. */}
                <motion.div
                  initial={{ scale: 0.3, rotateY: rankUp ? -90 : 0 }}
                  animate={{ scale: 1, rotateY: 0 }}
                  transition={{
                    delay: 0.15,
                    type: "spring",
                    damping: 12,
                    stiffness: 200,
                  }}
                  className="relative flex justify-center mb-5"
                  aria-label={`Level ${toLevel} — ${newTierTitle}`}
                >
                  {rankUp && (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 m-auto w-32 h-32 rounded-full blur-2xl pointer-events-none"
                      style={{ background: burstColor }}
                      initial={{ opacity: 0.9, scale: 0.5 }}
                      animate={{ opacity: 0, scale: 2.4 }}
                      transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
                    />
                  )}
                  <TierLevelFrame level={toLevel} />
                </motion.div>

                {/* Level transition sub-line */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-slate-300 text-base font-semibold mb-1"
                >
                  <span className="text-slate-500">{fromLevel}</span>
                  {" "}
                  <span className="text-amber-400 mx-1">→</span>
                  {" "}
                  <span className="text-white">{toLevel}</span>
                </motion.p>

                {/* New tier banner — bigger title, only on rank-up.
                    Uses motion delay so it lands after the badge flip. */}
                {displayRank && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.55, type: "spring", damping: 14 }}
                    className="mt-4 mb-2 px-4 py-3 rounded-xl border border-purple-500/40 bg-purple-900/20"
                  >
                    <p className="text-[10px] font-pixel text-purple-400 uppercase tracking-widest mb-1">
                      New Tier Unlocked
                    </p>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={{
                        fontFamily: "var(--font-pixel)",
                        color: "#d8b4fe",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {displayRank.toUpperCase()}
                    </p>
                  </motion.div>
                )}

                {/* Continue button */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: rankUp ? 0.7 : 0.5 }}
                  className="mt-6"
                >
                  <button
                    onClick={onClose}
                    className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    autoFocus
                  >
                    Continue
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
