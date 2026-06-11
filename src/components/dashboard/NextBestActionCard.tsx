"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Swords,
  Flame,
  Crown,
  Brain,
  BookOpen,
  Target,
  Skull,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  NextBestAction,
  ActionIcon,
  ActionTier,
  ClientGate,
} from "@/lib/next-best-action";

/**
 * Smart Next Best Action widget — one pixel-bordered card pinned at the top
 * of the dashboard that picks the single most-pressing action from the
 * already-computed dashboard data.
 *
 * The decision logic lives in `lib/next-best-action.ts` (pure). This
 * component just renders the current index from the prioritized list and
 * exposes a "Show next →" link to cycle through the remaining actions
 * without dismissing them.
 *
 * Cycle state is component-local: when the user lands again later, the
 * data has changed and the priority list re-sorts, so resetting to index
 * 0 is the right behavior (you don't want to be looking at #3 when #1 has
 * changed underneath you).
 */
interface NextBestActionCardProps {
  actions: NextBestAction[];
}

const ICON_MAP: Record<ActionIcon, React.ComponentType<{ className?: string }>> = {
  swords: Swords,
  flame: Flame,
  crown: Crown,
  brain: Brain,
  book: BookOpen,
  target: Target,
  skull: Skull,
};

const TIER_PALETTE: Record<
  ActionTier,
  {
    nail: string;
    accent: string;
    chipBg: string;
    chipText: string;
    iconBg: string;
    iconText: string;
    chipLabel: string;
    cta: string;
    /** "R G B" triplet for --alive-rgb / --w-rgb (card fill + breathe). */
    rgb: string;
  }
> = {
  S: {
    rgb: "239 68 68",
    nail: "bg-red-400",
    accent: "from-transparent via-red-400/40 to-transparent",
    chipBg: "bg-red-500/10",
    chipText: "text-red-300",
    iconBg: "bg-red-500/10",
    iconText: "text-red-400",
    chipLabel: "URGENT",
    cta:
      "bg-red-500 text-slate-950 shadow-[0_4px_0_0_#7f1d1d] hover:shadow-[0_2px_0_0_#7f1d1d] hover:translate-y-0.5 active:shadow-[0_0_0_0_#7f1d1d] active:translate-y-1",
  },
  A: {
    rgb: "245 158 11",
    nail: "bg-amber-400",
    accent: "from-transparent via-amber-400/40 to-transparent",
    chipBg: "bg-amber-500/10",
    chipText: "text-amber-300",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
    chipLabel: "HIGH LEVERAGE",
    cta:
      "bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f] hover:shadow-[0_2px_0_0_#78350f] hover:translate-y-0.5 active:shadow-[0_0_0_0_#78350f] active:translate-y-1",
  },
  B: {
    rgb: "99 102 241",
    nail: "bg-indigo-400",
    accent: "from-transparent via-indigo-400/40 to-transparent",
    chipBg: "bg-indigo-500/10",
    chipText: "text-indigo-300",
    iconBg: "bg-indigo-500/10",
    iconText: "text-indigo-400",
    chipLabel: "TODAY",
    cta:
      "bg-indigo-500 text-white shadow-[0_4px_0_0_#312e81] hover:shadow-[0_2px_0_0_#312e81] hover:translate-y-0.5 active:shadow-[0_0_0_0_#312e81] active:translate-y-1",
  },
};

/**
 * Evaluate a `ClientGate` against the user's actual local clock. Returns
 * true when the gate passes and the action should be visible.
 * Server-side `pickNextBestActions` runs on Vercel UTC so it can't decide
 * "is it after 6pm local" itself — see the helper's type comments.
 */
function evaluateClientGate(gate: ClientGate, now: Date): boolean {
  if (gate.type === "streak-save") {
    // (a) After the threshold hour in user-local time
    if (now.getHours() < gate.hour) return false;
    // (b) lastStudyDate is the user's local-yesterday. Compute local-
    //     yesterday's YYYY-MM-DD WITHOUT going through .toISOString()
    //     (which would shift back to UTC).
    if (!gate.lastStudyDate) return false;
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );
    const localYesterdayISO =
      `${yesterday.getFullYear()}-` +
      `${String(yesterday.getMonth() + 1).padStart(2, "0")}-` +
      `${String(yesterday.getDate()).padStart(2, "0")}`;
    return gate.lastStudyDate === localYesterdayISO;
  }
  return true;
}

export default function NextBestActionCard({ actions }: NextBestActionCardProps) {
  const [index, setIndex] = useState(0);
  // Re-render every ~60s so a streak-save action that should appear at
  // exactly 18:00 doesn't wait for the next user interaction. Cheap —
  // the component is small and the effect just bumps a counter.
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Filter actions whose ClientGate fails under the local clock. This is
  // the timezone-aware step that the server couldn't do — see comments on
  // the ClientGate type in lib/next-best-action.ts.
  const visibleActions = useMemo(() => {
    const now = new Date();
    return actions.filter(
      (a) => !a.clientGate || evaluateClientGate(a.clientGate, now),
    );
    // clockTick intentionally part of deps: forces re-filter on the timer tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, clockTick]);

  if (visibleActions.length === 0) return null;

  // Clamp in case the visible list shrinks (e.g. clock crossed the gate
  // threshold between renders and removed an action).
  const safeIndex = Math.min(index, visibleActions.length - 1);
  const action = visibleActions[safeIndex];
  const Icon = ICON_MAP[action.iconName];
  const palette = TIER_PALETTE[action.tier];
  const hasMore = visibleActions.length > 1;
  const isLast = safeIndex >= visibleActions.length - 1;

  return (
    <section
      aria-labelledby="next-best-action-heading"
      style={{
        ["--alive-rgb" as string]: palette.rgb,
        ["--w-rgb" as string]: palette.rgb,
      }}
      className="relative rpg-card card-alive widget-elev widget-breathe rounded-2xl px-5 py-5 sm:px-6 sm:py-6 overflow-hidden flex flex-col h-full"
    >
      {/* Dot-matrix texture — alive-pass depth, matches the Course Map cards */}
      <span aria-hidden className="absolute inset-0 hud-hero-texture pointer-events-none rounded-2xl" />

      {/* Status accent line — tier-colored */}
      <div className={cn("absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r", palette.accent)} />

      {/* Pixel nails — tier-colored */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[1]", palette.nail)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[1]", palette.nail)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[1]", palette.nail)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[1]", palette.nail)} />

      <div className="relative z-[1] flex items-start gap-4 sm:gap-5 flex-1">
        {/* Icon block */}
        <div
          className={cn(
            "shrink-0 w-12 h-12 sm:w-14 sm:h-14 pixel-border flex items-center justify-center",
            palette.iconBg,
            palette.iconText
          )}
        >
          <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>

        {/* Body — flex column so the CTA row can mt-auto to the bottom
            and align with ExamCountdown's cycle row when paired. */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Top row: NEXT MOVE marker + tier chip */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              id="next-best-action-heading"
              className="font-pixel text-[9px] tracking-widest text-slate-500"
            >
              NEXT MOVE
            </span>
            <span aria-hidden className="text-slate-700">·</span>
            <span
              className={cn(
                "font-pixel text-[9px] tracking-widest px-2 py-0.5 pixel-border",
                palette.chipBg,
                palette.chipText
              )}
            >
              {action.label}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
            {action.headline}
          </h2>

          {/* Context */}
          <p className="text-xs sm:text-sm text-slate-400 leading-snug">
            {action.context}
          </p>

          {/* CTAs — pushed to the bottom of the card so paired layouts
              keep their footer rows aligned. */}
          <div className="flex items-center gap-3 flex-wrap mt-auto pt-2">
            <Link
              href={action.href}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-pixel text-[10px] tracking-wider transition-transform duration-100 pixel-focus outline-none",
                palette.cta
              )}
            >
              {action.ctaLabel}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>

            {hasMore && (
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % visibleActions.length)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={
                  isLast
                    ? `Cycle back to first suggestion (${visibleActions.length} total)`
                    : `Show next suggestion (${safeIndex + 1} of ${visibleActions.length})`
                }
              >
                {isLast ? "Back to first" : "Show next"}
                <ChevronRight className="w-3 h-3" aria-hidden />
                <span className="font-pixel text-[8px] tracking-wider text-slate-600 ml-1">
                  {safeIndex + 1}/{visibleActions.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
