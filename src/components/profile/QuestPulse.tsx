"use client";

// ─── QuestPulse ──────────────────────────────────────────────────────────────
// Arcade-rhythm study activity timeline. Replaces the GitHub-style heatmap
// with a 90-day pixel-bar pulse + 4 stat tiles + weekday rhythm chart.
// Stitch generated the design language ("Quest Pulse Activity Timeline"); this
// adapts it into React using existing utilities (pixel-border, font-pixel,
// stat-label) and framer-motion for staggered entrances.

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestPulseProps {
  /** Map of YYYY-MM-DD → session count (from quiz + boss + review + feynman). */
  data: Record<string, number>;
  /** Current consecutive-day streak from users.current_streak. */
  currentStreak: number;
}

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const TIMELINE_DAYS = 90;

export default function QuestPulse({ data, currentStreak }: QuestPulseProps) {
  const reduceMotion = useReducedMotion();

  const derived = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build last 90 days, oldest → today
    const days: Array<{ dateStr: string; count: number; weekday: number }> = [];
    for (let i = TIMELINE_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        dateStr,
        count: data[dateStr] ?? 0,
        weekday: d.getDay(),
      });
    }

    const totalSessions = days.reduce((s, d) => s + d.count, 0);
    const activeDays = days.filter((d) => d.count > 0).length;
    const bestDay = days.reduce((m, d) => Math.max(m, d.count), 0);

    // Weekday averages — sum / observation count per weekday
    const sumByWd = [0, 0, 0, 0, 0, 0, 0];
    const cntByWd = [0, 0, 0, 0, 0, 0, 0];
    for (const d of days) {
      sumByWd[d.weekday] += d.count;
      cntByWd[d.weekday] += 1;
    }
    const weekdayAvgs = sumByWd.map((s, i) => (cntByWd[i] > 0 ? s / cntByWd[i] : 0));
    const maxWeekdayAvg = Math.max(...weekdayAvgs);
    // If nobody studied yet, leave peak undefined (no crown).
    const peakWeekday = maxWeekdayAvg > 0 ? weekdayAvgs.indexOf(maxWeekdayAvg) : -1;

    return {
      days,
      totalSessions,
      activeDays,
      bestDay,
      weekdayAvgs,
      maxWeekdayAvg,
      peakWeekday,
    };
  }, [data]);

  // Scale: ensure visual range even on light data. Floor at 5 sessions for shape.
  const maxBar = Math.max(5, derived.bestDay);

  function barHeightPct(count: number): number {
    if (count === 0) return 6; // visible baseline dot
    return Math.max(14, Math.round((count / maxBar) * 100));
  }

  function barClass(count: number): string {
    if (count === 0) return "bg-slate-700/40";
    if (count <= 1) return "bg-amber-800";
    if (count <= 3) return "bg-amber-600";
    if (count <= 5) return "bg-amber-500";
    return "bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-300";
  }

  const streakSub =
    currentStreak >= 7
      ? "🔥 on fire"
      : currentStreak > 0
      ? "burning bright"
      : "begin today";

  return (
    <div className="rpg-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
      {/* Indigo accent line + pixel nails — matches profile vocabulary */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />

      <div className="relative">
        {/* ── Row 1: 4 stat tiles ── */}
        <motion.div
          initial={reduceMotion ? "show" : "hidden"}
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
          }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6"
        >
          <StatTile
            label="ACTIVE DAYS"
            value={derived.activeDays.toString()}
            sub="of last 90 days"
            accent="emerald"
          />
          <StatTile
            label="TOTAL SESSIONS"
            value={derived.totalSessions.toString()}
            sub="battles fought"
            accent="amber"
          />
          <StatTile
            label="BEST DAY"
            value={derived.bestDay.toString()}
            sub="max in one day"
            accent="indigo"
          />
          <StatTile
            label="CURRENT STREAK"
            value={currentStreak > 0 ? `${currentStreak}d` : "—"}
            sub={streakSub}
            accent="orange"
          />
        </motion.div>

        {/* ── Row 2: Quest Pulse timeline ── */}
        <div className="mb-2">
          <div className="font-pixel text-[9px] tracking-wider text-amber-400/80 mb-3 flex items-center gap-2">
            <span aria-hidden>⚡</span>
            QUEST PULSE
            <span className="text-slate-700">&middot;</span>
            <span className="text-slate-500">{TIMELINE_DAYS} DAYS</span>
          </div>

          <div
            className="flex items-end gap-[2px] h-[120px] px-1.5 pt-2 pb-2 pixel-border bg-slate-950/40 text-indigo-500/30"
            role="img"
            aria-label={`Study pulse over last ${TIMELINE_DAYS} days: ${derived.totalSessions} sessions across ${derived.activeDays} active days`}
          >
            {derived.days.map((d, i) => (
              <motion.div
                key={d.dateStr}
                title={
                  d.count > 0
                    ? `${d.dateStr} — ${d.count} session${d.count !== 1 ? "s" : ""}`
                    : d.dateStr
                }
                initial={reduceMotion ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{
                  delay: reduceMotion ? 0 : 0.4 + i * 0.008,
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  height: `${barHeightPct(d.count)}%`,
                  transformOrigin: "bottom",
                }}
                className={cn("flex-1 min-w-0 rounded-[1px]", barClass(d.count))}
              />
            ))}
          </div>

          {/* Timeline anchor labels */}
          <div className="flex justify-between mt-2 font-pixel text-[8px] tracking-wider text-slate-600">
            <span>~90D AGO</span>
            <span>~60D</span>
            <span>~30D</span>
            <span>TODAY</span>
          </div>
        </div>

        {/* ── Row 3: Weekday rhythm ── */}
        <div className="mt-6 pt-5 border-t border-white/[0.06]">
          <div className="font-pixel text-[9px] tracking-wider text-amber-400/80 mb-3 flex items-center gap-2">
            <Crown className="w-3 h-3" />
            WEEKLY RHYTHM
            {derived.peakWeekday >= 0 && (
              <>
                <span className="text-slate-700">&middot;</span>
                <span className="text-amber-300">
                  PEAK {WEEKDAY_LABELS[derived.peakWeekday]}
                </span>
              </>
            )}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((wd, i) => {
              const avg = derived.weekdayAvgs[i];
              const isPeak = i === derived.peakWeekday;
              const heightPct =
                derived.maxWeekdayAvg > 0 ? (avg / derived.maxWeekdayAvg) * 100 : 0;
              return (
                <div key={wd} className="flex flex-col items-center min-w-0">
                  <div className="w-full h-[44px] flex items-end mb-1.5">
                    <motion.div
                      initial={reduceMotion ? { height: `${Math.max(heightPct, 6)}%` } : { height: 0 }}
                      animate={{ height: `${Math.max(heightPct, 6)}%` }}
                      transition={{
                        delay: reduceMotion ? 0 : 1.2 + i * 0.06,
                        duration: 0.5,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={cn(
                        "w-full rounded-[1px]",
                        isPeak
                          ? "bg-gradient-to-t from-amber-600 to-yellow-300"
                          : avg > 0
                          ? "bg-indigo-500/50"
                          : "bg-slate-700/40"
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "font-pixel text-[8px] tracking-wider flex items-center gap-1",
                      isPeak ? "text-amber-300" : "text-slate-500"
                    )}
                  >
                    {wd}
                    {isPeak && (
                      <span aria-hidden className="text-amber-400">
                        ★
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Row 4: Legend ── */}
        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-pixel text-[8px] tracking-wider text-slate-600">LESS</span>
            <div className="w-3 h-3 bg-slate-700/40 rounded-[1px]" />
            <div className="w-3 h-3 bg-amber-800 rounded-[1px]" />
            <div className="w-3 h-3 bg-amber-600 rounded-[1px]" />
            <div className="w-3 h-3 bg-amber-500 rounded-[1px]" />
            <div className="w-3 h-3 bg-gradient-to-t from-amber-600 to-yellow-300 rounded-[1px]" />
            <span className="font-pixel text-[8px] tracking-wider text-slate-600">MORE</span>
          </div>
          <span className="font-pixel text-[8px] tracking-wider text-slate-600">
            LAST {TIMELINE_DAYS} DAYS
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "amber" | "indigo" | "orange";
}

const ACCENT_TONES: Record<StatTileProps["accent"], { line: string; label: string; nail: string }> = {
  emerald: {
    line: "bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent",
    label: "text-emerald-400",
    nail: "bg-emerald-400",
  },
  amber: {
    line: "bg-gradient-to-r from-transparent via-amber-400/50 to-transparent",
    label: "text-amber-400",
    nail: "bg-amber-400",
  },
  indigo: {
    line: "bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent",
    label: "text-indigo-400",
    nail: "bg-indigo-400",
  },
  orange: {
    line: "bg-gradient-to-r from-transparent via-orange-400/50 to-transparent",
    label: "text-orange-400",
    nail: "bg-orange-400",
  },
};

const tileVariant = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

function StatTile({ label, value, sub, accent }: StatTileProps) {
  const tones = ACCENT_TONES[accent];
  return (
    <motion.div
      variants={tileVariant}
      className="relative px-3 py-3 bg-slate-950/40 rounded-lg overflow-hidden"
    >
      {/* Top accent line — the only chrome; no surrounding frame */}
      <div className={cn("absolute top-0 inset-x-0 h-px", tones.line)} />

      <div className={cn("stat-label", tones.label)}>{label}</div>
      <div className="font-bold text-white text-2xl leading-none tracking-tight tabular-nums mt-2">
        {value}
      </div>
      <div className="stat-label text-slate-500 mt-2 truncate">{sub}</div>
    </motion.div>
  );
}
