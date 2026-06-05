"use client";

// ─── ProfileHeroCard ──────────────────────────────────────────────────────────
// Client island for the profile page hero. Matches DashboardHeroCard's animation
// language: outer fade-up + spring level frame + staggered stat tiles + delayed
// pixel-XP fill. Page itself stays a server component — this is rendered as a
// client child.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Swords, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import TierLevelFrame from "@/components/gamification/TierLevelFrame";
import { getStreakTitle, getStreakAuraLevel } from "@/lib/streak";

interface XPProgress {
  current: number;
  needed: number;
  percentage: number;
}

interface Props {
  level: number;
  rankTitle: string;
  xpProgress: XPProgress;
  name: string;
  email: string | null;
  memberSinceLabel: string | null;
  totalXp: number;
  currentStreak: number;
  isHotStreak: boolean;
  streakHint: string;
  totalSessions: number;
  earnedCount: number;
  totalAchievements: number;
}

// ── Animation variants (mirror DashboardHeroCard) ───────────────────────────

const tileContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.32 } },
};

const tileVariant = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } },
};

// ── Stat tile ────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  sub: string;
  accentVia: string;
  glowColor: string;
  labelClass: string;
  children: React.ReactNode;
}

function StatTile({ label, sub, accentVia, glowColor, labelClass, children }: StatTileProps) {
  return (
    <motion.div
      variants={tileVariant}
      className="relative overflow-hidden group"
      style={{
        background: "rgba(6, 5, 20, 0.90)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent",
          accentVia
        )}
      />
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${glowColor}, transparent)`,
        }}
      />
      <div className="relative px-5 py-4">
        <div className={cn("stat-label mb-2.5", labelClass)}>{label}</div>
        {children}
        <div className="stat-label text-slate-500 mt-2">{sub}</div>
      </div>
    </motion.div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProfileHeroCard({
  level,
  rankTitle,
  xpProgress,
  name,
  email,
  memberSinceLabel,
  totalXp,
  currentStreak,
  isHotStreak,
  streakHint,
  totalSessions,
  earnedCount,
  totalAchievements,
}: Props) {
  // Streak Title — pure function of the current streak (null below 7 days).
  // Orthogonal to the level-derived Rank chip above the name.
  const streakTitle = getStreakTitle(currentStreak);

  // Streak aura intensity (0–5) — strengthens the crest's fire halo in lockstep
  // with the Streak Title. 0 below 7 days → no aura rendered.
  const auraLevel = getStreakAuraLevel(currentStreak);

  // Trigger CSS-transition XP fill after mount (same pattern as DashboardHeroCard).
  const [xpWidth, setXpWidth] = useState("0%");
  useEffect(() => {
    const t = setTimeout(() => setXpWidth(`${xpProgress.percentage}%`), 480);
    return () => clearTimeout(t);
  }, [xpProgress.percentage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: "rgba(8, 6, 25, 0.84)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(99, 102, 241, 0.20)",
        boxShadow:
          "0 0 0 1px rgba(99,102,241,0.06), 0 8px 40px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.045)",
      }}
    >
      {/* Indigo top accent line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* Dot-matrix texture overlay */}
      <div className="absolute inset-0 hud-hero-texture rounded-2xl pointer-events-none" />

      {/* Header strip */}
      <div className="relative px-5 sm:px-7 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-white/[0.05]">
        <span className="stat-label text-amber-400/80 flex items-center gap-2">
          <Swords className="w-3.5 h-3.5" />
          ADVENTURER PROFILE
        </span>
        {memberSinceLabel && (
          <span className="text-[11px] text-slate-500 font-medium tracking-wide">
            Joined {memberSinceLabel}
          </span>
        )}
      </div>

      {/* Level frame + identity + XP bar */}
      <div className="relative px-5 sm:px-7 pt-5 pb-6 flex items-start gap-4">

        {/* Level frame — spring entrance. TierLevelFrame picks the
            palette + decoration set from the level number, so identity
            scales with rank (slate → amber → cyan → gold → violet → gradient). */}
        <motion.div
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 220, delay: 0.08 }}
          className="relative"
        >
          {/* Streak aura — fire halo behind the frame, only once a Streak Title
              is held (auraLevel ≥ 1). Decorative; the Streak Title chip is the
              non-decorative cue. */}
          {auraLevel > 0 && (
            <span
              aria-hidden
              className="profile-crest-aura"
              style={{ ["--aura" as string]: auraLevel }}
            />
          )}
          <TierLevelFrame level={level} />
        </motion.div>

        {/* Identity + XP */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="rank-chip rank-chip-shimmer mb-2.5">
            <span aria-hidden="true" className="opacity-50">&#9670;</span>
            <span>{rankTitle.toUpperCase()}</span>
            <span aria-hidden="true" className="opacity-50">&#9670;</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white truncate leading-tight tracking-tight">
            {name || "Adventurer"}
          </h1>

          {/* Streak Title — fire honorific earned at 7/14/30/60/100-day
              streaks. Hidden below the first threshold. */}
          {streakTitle && (
            <div className="rank-chip streak-title-chip mt-2">
              <Flame aria-hidden="true" className="w-2.5 h-2.5" />
              <span>{streakTitle.toUpperCase()}</span>
            </div>
          )}

          {email ? (
            <p className="text-slate-500 text-sm mt-1 mb-3 truncate">{email}</p>
          ) : (
            <div className="mb-3" />
          )}

          {/* Pixel XP bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="stat-label text-amber-500/70">XP Progress</span>
              <span className="text-[11px] text-slate-400 tabular-nums font-medium">
                {xpProgress.current.toLocaleString()} / {xpProgress.needed.toLocaleString()}
              </span>
            </div>
            <div
              className="pixel-xp-bar"
              role="progressbar"
              aria-valuenow={xpProgress.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`XP progress to level ${level + 1}: ${xpProgress.percentage}% complete`}
            >
              <div className="pixel-xp-bar-fill" style={{ width: xpWidth }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="stat-label text-slate-600">LV.{level}</span>
              <span className="stat-label text-indigo-400/50">
                {100 - xpProgress.percentage}% to next rank
              </span>
              <span className="stat-label text-slate-600">LV.{level + 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat grid — staggered entrance */}
      <motion.div
        variants={tileContainer}
        initial="hidden"
        animate="show"
        className="relative grid grid-cols-2 sm:grid-cols-4 gap-px"
        style={{
          background: "rgba(99,102,241,0.08)",
          borderTop: "1px solid rgba(99,102,241,0.10)",
        }}
      >
        <StatTile
          label="Total XP"
          sub="Battle Spoils"
          accentVia="via-amber-400/50"
          glowColor="rgba(245,158,11,0.12)"
          labelClass="text-amber-400"
        >
          <div className="font-bold text-amber-400 text-2xl leading-none tracking-tight tabular-nums">
            {totalXp.toLocaleString()}
          </div>
        </StatTile>

        <StatTile
          label="Streak"
          sub={streakHint}
          accentVia={isHotStreak ? "via-orange-400/60" : currentStreak > 0 ? "via-orange-400/40" : "via-slate-600/20"}
          glowColor={isHotStreak ? "rgba(249,115,22,0.14)" : "rgba(100,116,139,0.06)"}
          labelClass={isHotStreak || currentStreak > 0 ? "text-orange-400" : "text-slate-400"}
        >
          <div
            className={cn(
              "text-2xl font-bold leading-none tracking-tight",
              currentStreak > 0
                ? isHotStreak
                  ? "text-orange-400 animate-fire-glow"
                  : "text-orange-400"
                : "text-white"
            )}
          >
            {currentStreak > 0 ? currentStreak : "—"}
            {currentStreak > 0 && (
              <span className="text-sm font-medium text-slate-500 ml-0.5">d</span>
            )}
          </div>
        </StatTile>

        <StatTile
          label="Sessions"
          sub="Quests Logged"
          accentVia="via-indigo-400/30"
          glowColor="rgba(99,102,241,0.10)"
          labelClass="text-slate-400"
        >
          <div className="font-bold text-white text-2xl leading-none tracking-tight tabular-nums">
            {totalSessions}
          </div>
        </StatTile>

        <StatTile
          label="Trophies"
          sub="Hall of Honor"
          accentVia="via-purple-400/50"
          glowColor="rgba(168,85,247,0.12)"
          labelClass="text-purple-400"
        >
          <div className="font-bold text-white text-2xl leading-none tracking-tight tabular-nums">
            {earnedCount}
            <span className="text-slate-600 text-lg font-normal">/{totalAchievements}</span>
          </div>
        </StatTile>
      </motion.div>
    </motion.div>
  );
}
