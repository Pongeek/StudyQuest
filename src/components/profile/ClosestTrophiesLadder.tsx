// ─── ClosestTrophiesLadder ────────────────────────────────────────────────────
// The forward-looking "Closest Trophies" module on the profile Overview: the
// nearest unearned, started-but-unfinished countable achievements, each with a
// progress bar (e.g. "8 / 10"). Ranking + filtering is done by the pure
// `computeClosestTrophies` helper; this is presentational only.
//
// Server component — purely static display. The count-up / bar-fill-on-tab-in
// animation is a separate polish slice (#25).

import { Target, Trophy } from "lucide-react";
import CountUp from "@/components/profile/CountUp";
import ProgressFill from "@/components/profile/ProgressFill";

export interface LadderItem {
  id: string;
  name: string;
  /** Emoji icon stored on the achievement row. */
  icon: string;
  current: number;
  target: number;
  /** Floored percent complete, 0–99. */
  pct: number;
}

export default function ClosestTrophiesLadder({ items }: { items: LadderItem[] }) {
  return (
    <div className="rpg-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
      {/* Amber accent line + pixel nails — matches the trophy vocabulary */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />

      <header className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 pixel-border bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
          <Target className="w-4 h-4" />
        </div>
        <div>
          <div className="font-pixel text-[9px] tracking-wider text-amber-400/90">
            CLOSEST TROPHIES
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
            Almost There
          </h2>
        </div>
      </header>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 shrink-0 pixel-border bg-amber-500/[0.07] flex items-center justify-center text-xl leading-none">
                <span aria-hidden>{it.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <span className="text-[14.5px] text-white font-semibold truncate leading-snug">
                    {it.name}
                  </span>
                  <span className="font-pixel text-[10px] tracking-wider text-amber-300 tabular-nums shrink-0">
                    {it.current}
                    <span className="text-slate-600">/{it.target}</span>
                  </span>
                </div>
                <div
                  className="h-2 rounded-full bg-slate-800/80 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={it.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${it.name}: ${it.current} of ${it.target}, ${it.pct}% complete`}
                >
                  <ProgressFill
                    pct={Math.max(it.pct, 4)}
                    animKey={`ladder-bar-${it.id}`}
                    className="xp-shimmer"
                  />
                </div>
              </div>
              <div className="w-9 text-right shrink-0">
                <span className="text-amber-400 font-bold tabular-nums text-sm">
                  <CountUp value={it.pct} animKey={`ladder-pct-${it.id}`} suffix="%" />
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Trophy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-400">No trophies in progress</p>
          <p className="text-xs text-slate-500 mt-1">
            Take a quest to start chasing your next relic.
          </p>
        </div>
      )}
    </div>
  );
}
