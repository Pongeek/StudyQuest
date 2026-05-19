"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "./Confetti";
import { useSound } from "@/lib/useSound";

export interface UnlockedAchievement {
  slug: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
}

interface AchievementUnlockOverlayProps {
  achievements: UnlockedAchievement[];
  onAllDismissed: () => void;
}

const AUTO_ADVANCE_MS = 4000;

export default function AchievementUnlockOverlay({
  achievements,
  onAllDismissed,
}: AchievementUnlockOverlayProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const current = achievements[currentIdx];
  const isLast = currentIdx >= achievements.length - 1;
  const { play } = useSound();

  // Play the fanfare each time a new achievement card surfaces.
  useEffect(() => {
    if (achievements.length > 0) play("achievement");
  }, [currentIdx, achievements.length, play]);

  const advance = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isLast) {
      onAllDismissed();
    } else {
      setCurrentIdx((i) => i + 1);
      setProgress(0);
      setConfettiTrigger((c) => c + 1);
    }
  }, [isLast, onAllDismissed]);

  // Fire confetti on mount and each advance
  useEffect(() => {
    setConfettiTrigger((c) => c + 1);
  }, []);

  // Auto-advance timer with progress bar
  useEffect(() => {
    if (achievements.length === 0) return;
    startTimeRef.current = Date.now();
    setProgress(0);

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100);
      setProgress(pct);
      if (elapsed >= AUTO_ADVANCE_MS) {
        advance();
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, achievements.length, advance]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") advance();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [advance]);

  if (achievements.length === 0) return null;

  return (
    <>
      <Confetti trigger={confettiTrigger} count={50} duration={2500} />

      <div
        className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/75 backdrop-blur-md"
        onClick={advance}
        aria-modal="true"
        role="dialog"
        aria-label={`Achievement unlocked: ${current?.name}`}
      >
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.slug}
              initial={{ opacity: 0, scale: 0.85, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -12 }}
              transition={{ type: "spring", damping: 16, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-sm"
            >
              <div className="rpg-card-gold rounded-2xl overflow-hidden">
                {/* Header ribbon */}
                <div className="px-6 pt-5 pb-3 text-center border-b border-amber-500/20">
                  <p className="font-pixel text-[9px] text-amber-300 uppercase tracking-[0.2em]">
                    Achievement Unlocked
                  </p>
                </div>

                {/* Body */}
                <div className="px-6 py-6 text-center space-y-3">
                  {/* Icon */}
                  <motion.div
                    key={`icon-${current.slug}`}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      delay: 0.05,
                      type: "spring",
                      damping: 10,
                      stiffness: 180,
                    }}
                    className="text-6xl leading-none"
                    aria-hidden
                  >
                    {current.icon}
                  </motion.div>

                  {/* Name */}
                  <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
                    {current.name}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {current.description}
                  </p>

                  {/* XP pill */}
                  <div className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full px-4 py-1.5">
                    <span className="text-sm font-bold text-amber-300">
                      +{current.xp_reward} XP
                    </span>
                  </div>

                  {/* Next / Done button */}
                  <button
                    onClick={advance}
                    className="w-full mt-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    autoFocus
                  >
                    {isLast ? "Done" : `Next (${achievements.length - currentIdx - 1} more)`}
                  </button>
                </div>

                {/* Auto-advance progress bar */}
                <div className="h-1 w-full bg-white/[0.06]">
                  <div
                    className="h-full bg-amber-500/60 transition-none"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Auto-advance timer"
                  />
                </div>
              </div>

              {/* Queue indicator dots */}
              {achievements.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {achievements.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                        i === currentIdx
                          ? "bg-amber-400"
                          : i < currentIdx
                          ? "bg-amber-700/60"
                          : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
