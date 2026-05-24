"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedCounter from "@/components/effects/AnimatedCounter";
import TierLevelFrame from "@/components/gamification/TierLevelFrame";
import { cn } from "@/lib/utils";
import { getLevelTitle } from "@/lib/xp";

interface XPProgress {
  current: number;
  needed: number;
  percentage: number;
}

interface HeroUser {
  name: string;
  total_xp: number;
  topics_mastered: number;
  total_sessions: number;
  current_streak: number;
}

interface Props {
  level: number;
  xpProgress: XPProgress;
  dbUser: HeroUser;
  studiedToday: boolean;
  streak: number;
  isHotStreak: boolean;
}

// ── Animation variants ──────────────────────────────────────────────────────

const tileContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.32 } },
};

const tileVariant = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } },
};

// ── Stat tile ───────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  sub: string;
  accentVia: string;     // Tailwind via-* class for the top accent gradient
  glowColor: string;     // rgba value for the hover radial glow
  labelClass: string;
  children: React.ReactNode; // value rendering
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
      {/* Colored top accent line */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent",
          accentVia
        )}
      />

      {/* Hover glow spills down from the accent line */}
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

// ── Hero card ───────────────────────────────────────────────────────────────

export default function DashboardHeroCard({
  level,
  xpProgress,
  dbUser,
  studiedToday,
  streak,
  isHotStreak,
}: Props) {
  // Trigger CSS-transition XP fill after mount (avoids SSR/hydration mismatch)
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
      <div className="absolute inset-0 hud-hero-texture rounded-2xl" />

      {/* ── Top: level frame + user info + CTA ── */}
      <div className="relative px-5 pt-5 pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">

          {/* Level frame — spring entrance. Tier chrome (palette,
              decorations, glow style) is picked by TierLevelFrame from
              the level number, so the visual identity scales with rank. */}
          <motion.div
            initial={{ scale: 0.82, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 18, stiffness: 220, delay: 0.08 }}
          >
            <TierLevelFrame level={level} />
          </motion.div>

          {/* User info */}
          <div className="flex-1 min-w-0 pt-1">
            {/* Rank chip with pulsing border */}
            <div className="rank-chip rank-chip-shimmer mb-2.5">
              <span aria-hidden="true" className="opacity-50">&#9670;</span>
              <span>{getLevelTitle(level).toUpperCase()}</span>
              <span aria-hidden="true" className="opacity-50">&#9670;</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate leading-tight tracking-tight">
              {dbUser.name.split(" ")[0] || "Adventurer"}
            </h1>

            <p className="text-slate-500 text-sm mt-1 mb-3">
              {studiedToday
                ? `Today's quest complete · ${streak}-day streak burning`
                : "Your adventure continues..."}
            </p>

            {/* Pixel XP bar — CSS transition triggered on mount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="stat-label text-amber-500/70">XP to next level</span>
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
                  {100 - xpProgress.percentage}% to go
                </span>
                <span className="stat-label text-slate-600">LV.{level + 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* New Course CTA */}
        <Link href="/dashboard/courses/new" className="shrink-0 self-start sm:self-auto mt-1">
          <Button className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-400 text-white gap-2 font-medium">
            <Plus className="w-4 h-4" /> New Course
          </Button>
        </Link>
      </div>

      {/* ── Stat HUD grid — staggered entrance ── */}
      <motion.div
        variants={tileContainer}
        initial="hidden"
        animate="show"
        className="relative grid grid-cols-2 lg:grid-cols-4 gap-px"
        style={{
          background: "rgba(99,102,241,0.08)",
          borderTop: "1px solid rgba(99,102,241,0.10)",
        }}
      >
        <StatTile
          label="Mastered"
          sub="Topics"
          accentVia="via-emerald-400/50"
          glowColor="rgba(16,185,129,0.12)"
          labelClass="text-emerald-400"
        >
          <AnimatedCounter
            value={dbUser.topics_mastered || 0}
            duration={0.8}
            format={false}
            className="font-bold text-white text-2xl leading-none tracking-tight"
          />
        </StatTile>

        <StatTile
          label="Total XP"
          sub="Points"
          accentVia="via-amber-400/50"
          glowColor="rgba(245,158,11,0.12)"
          labelClass="text-amber-400"
        >
          <AnimatedCounter
            value={dbUser.total_xp || 0}
            duration={1}
            format={false}
            className="font-bold text-amber-400 text-2xl leading-none tracking-tight"
          />
        </StatTile>

        <StatTile
          label="Streak"
          sub={isHotStreak ? "Hot 🔥" : "Days"}
          accentVia={isHotStreak ? "via-orange-400/60" : "via-slate-600/20"}
          glowColor={isHotStreak ? "rgba(249,115,22,0.14)" : "rgba(100,116,139,0.06)"}
          labelClass={isHotStreak ? "text-orange-400" : "text-slate-400"}
        >
          <div
            className={cn(
              "text-2xl font-bold leading-none tracking-tight",
              isHotStreak ? "text-orange-400 animate-fire-glow" : "text-white"
            )}
          >
            {streak}
            <span className="text-sm font-medium text-slate-500 ml-0.5">d</span>
          </div>
        </StatTile>

        <StatTile
          label="Sessions"
          sub="Completed"
          accentVia="via-indigo-400/30"
          glowColor="rgba(99,102,241,0.10)"
          labelClass="text-slate-400"
        >
          <AnimatedCounter
            value={dbUser.total_sessions || 0}
            duration={1}
            format={false}
            className="font-bold text-white text-2xl leading-none tracking-tight"
          />
        </StatTile>
      </motion.div>
    </motion.div>
  );
}
