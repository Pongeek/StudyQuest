"use client";

import { useEffect, useState } from "react";
import TierLevelFrame from "@/components/gamification/TierLevelFrame";

type Phase = { level: number; rank: string; xpPct: number };

const PHASES: Phase[] = [
  { level: 1, rank: "Novice", xpPct: 30 },
  { level: 2, rank: "Novice", xpPct: 70 },
  { level: 3, rank: "Apprentice", xpPct: 100 },
];

const CYCLE_MS = 4000;

export default function LandingHeroVisual() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Static display when reduced motion
  const displayPhase = reducedMotion ? PHASES[2] : PHASES[phaseIdx];

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setPhaseIdx((prev) => (prev + 1) % PHASES.length);
        setAnimating(false);
      }, 350);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const { level, rank, xpPct } = displayPhase;
  const currentXp = Math.round(xpPct * 3);

  return (
    <div className="flex flex-col items-center justify-center gap-7 select-none w-full">
      {/* Character HUD card — pixel-elegant, matches dashboard/profile hero */}
      <div className="rpg-card rounded-2xl w-full max-w-[30rem] overflow-hidden relative border border-white/[0.07]">
        {/* Dot-matrix texture */}
        <div className="absolute inset-0 hud-hero-texture rounded-2xl" />

        {/* Top: level frame + identity */}
        <div className="relative px-7 pt-7 pb-6 flex items-start gap-5">
          {/* Pixel level frame — tier-aware. Hover/animation transform
              applied to the wrapper so the spring tier decorations
              (rune ring, etc.) move with the frame. */}
          <div
            style={{
              transform: animating ? "scale(1.08)" : "scale(1)",
              transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <TierLevelFrame level={level} />
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 pt-1">
            {/* Rank chip */}
            <div
              className="rank-chip mb-2"
              style={{
                opacity: animating ? 0 : 1,
                transition: "opacity 0.25s ease-out",
              }}
            >
              <span aria-hidden="true" className="opacity-50">&#9670;</span>
              <span>{rank.toUpperCase()}</span>
              <span aria-hidden="true" className="opacity-50">&#9670;</span>
            </div>

            {/* Name */}
            <h3 className="text-2xl font-bold text-white truncate leading-tight tracking-tight">
              Scholar
            </h3>
            <p className="text-slate-500 text-sm mt-1">Adventurer</p>
          </div>
        </div>

        {/* Pixel XP bar */}
        <div className="relative px-7 pb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="stat-label text-amber-500/70">XP</span>
            <span className="text-[11px] text-amber-300 tabular-nums font-medium">
              {currentXp}
              <span className="text-slate-600">/300</span>
            </span>
          </div>
          <div
            className="pixel-xp-bar"
            role="progressbar"
            aria-valuenow={xpPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Demo XP progress: ${xpPct}% to level ${level + 1}`}
          >
            <div
              className="pixel-xp-bar-fill"
              style={{
                width: `${xpPct}%`,
                transition: reducedMotion
                  ? "none"
                  : "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="stat-label text-slate-600">LV.{level}</span>
            <span className="stat-label text-slate-600">LV.{level + 1}</span>
          </div>
        </div>

        {/* Stat grid — matches dashboard tile style */}
        <div className="relative grid grid-cols-2 gap-px bg-white/[0.06] border-t border-white/[0.06]">
          <div className="bg-slate-950/95 px-6 py-5">
            <div className="stat-label text-orange-400 mb-2">Streak</div>
            <div className="text-3xl font-bold leading-none tracking-tight text-orange-400 animate-fire-glow">
              7
              <span className="text-base font-medium text-slate-500 ml-0.5">d</span>
            </div>
            <div className="stat-label text-slate-500 mt-2">Hot &#128293;</div>
          </div>

          <div className="bg-slate-950/95 px-6 py-5">
            <div className="stat-label text-emerald-400 mb-2">Mastered</div>
            <div className="text-3xl font-bold leading-none tracking-tight text-white tabular-nums">
              3
            </div>
            <div className="stat-label text-slate-500 mt-2">Topics</div>
          </div>
        </div>
      </div>

      {/* Ambient caption */}
      <p className="text-sm text-slate-500 text-center max-w-[280px] leading-relaxed">
        Every answer earns XP and pushes your level higher
      </p>
    </div>
  );
}
