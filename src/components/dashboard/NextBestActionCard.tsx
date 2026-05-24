"use client";

import { useState } from "react";
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
import type { NextBestAction, ActionIcon, ActionTier } from "@/lib/next-best-action";

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
  }
> = {
  S: {
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

export default function NextBestActionCard({ actions }: NextBestActionCardProps) {
  const [index, setIndex] = useState(0);

  if (actions.length === 0) return null;

  // Clamp in case the prop list shrinks between renders (defensive — the
  // parent re-renders shouldn't normally change the list mid-session).
  const safeIndex = Math.min(index, actions.length - 1);
  const action = actions[safeIndex];
  const Icon = ICON_MAP[action.iconName];
  const palette = TIER_PALETTE[action.tier];
  const hasMore = actions.length > 1;
  const isLast = safeIndex >= actions.length - 1;

  return (
    <section
      aria-labelledby="next-best-action-heading"
      className="relative rpg-card rounded-2xl px-5 py-5 sm:px-6 sm:py-6 overflow-hidden"
    >
      {/* Status accent line — tier-colored */}
      <div className={cn("absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r", palette.accent)} />

      {/* Pixel nails — tier-colored */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[1]", palette.nail)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[1]", palette.nail)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[1]", palette.nail)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[1]", palette.nail)} />

      <div className="relative z-[1] flex items-start gap-4 sm:gap-5">
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

        {/* Body */}
        <div className="flex-1 min-w-0 space-y-2">
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

          {/* CTAs */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
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
                onClick={() => setIndex((i) => (i + 1) % actions.length)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={
                  isLast
                    ? `Cycle back to first suggestion (${actions.length} total)`
                    : `Show next suggestion (${safeIndex + 1} of ${actions.length})`
                }
              >
                {isLast ? "Back to first" : "Show next"}
                <ChevronRight className="w-3 h-3" aria-hidden />
                <span className="font-pixel text-[8px] tracking-wider text-slate-600 ml-1">
                  {safeIndex + 1}/{actions.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
