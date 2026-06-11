"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Sparkles, Sword, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodaysMissionProps {
  /** Current consecutive-day streak from users.current_streak */
  streak: number;
  /** Whether the user has completed any session today */
  studiedToday: boolean;
  /** Where the primary CTA should link. Falls back to /dashboard/courses if no recommendation exists. */
  nextQuestHref: string | null;
}

/**
 * Daily-quest hook shown on the dashboard above the Quest Board.
 *
 * Tier A (full pixel) treatment to match Hero + Quest Board: pixel-border,
 * pixel nail corners, pixel-font TODAY'S MISSION micro-label, chunky
 * pixel-shadow CTA. hasStreak swings amber (streak rescue); no-streak swings
 * indigo (begin first streak).
 *
 * States:
 *  - studied today           → null (don't waste vertical space)
 *  - streak ≥ 1, not today   → amber "streak at risk" rescue CTA
 *  - no streak yet           → indigo "ignite a streak" CTA
 */
export default function TodaysMission({
  streak,
  studiedToday,
  nextQuestHref,
}: TodaysMissionProps) {
  const reduceMotion = useReducedMotion();

  if (studiedToday) return null;

  const hasStreak = streak >= 1;
  const href = nextQuestHref ?? "/dashboard";

  // Tier-based color tokens. Featured = amber (streak in danger);
  // standard = indigo (no streak yet).
  const nailColor = hasStreak ? "bg-amber-400/80" : "bg-indigo-400/80";
  const accentLine = hasStreak
    ? "bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"
    : "bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent";
  const microLabelColor = hasStreak ? "text-amber-400/90" : "text-indigo-400/90";
  const iconTileBg = hasStreak
    ? "bg-amber-500/10 text-amber-500"
    : "bg-indigo-500/10 text-indigo-500";
  const ctaPalette = hasStreak
    ? "bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f] hover:shadow-[0_2px_0_0_#78350f] active:shadow-[0_0_0_0_#78350f]"
    : "bg-indigo-500 text-white shadow-[0_4px_0_0_#312e81] hover:shadow-[0_2px_0_0_#312e81] active:shadow-[0_0_0_0_#312e81]";

  return (
    <motion.section
      aria-labelledby="todays-mission-heading"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        ["--alive-rgb" as string]: hasStreak ? "245 158 11" : "99 102 241",
      }}
      className="relative rpg-card card-alive widget-elev rounded-2xl overflow-hidden px-5 py-5 sm:px-6 sm:py-6"
    >
      {/* Dot-matrix texture — alive-pass depth */}
      <span aria-hidden className="absolute inset-0 hud-hero-texture pointer-events-none rounded-2xl" />

      {/* Top accent line — semantic color signal, replaces the full border */}
      <div aria-hidden className={cn("absolute top-0 inset-x-0 h-0.5", accentLine)} />

      {/* Pixel nail corners — match Quest Board card vocabulary */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[1]", nailColor)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[1]", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[1]", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[1]", nailColor)} />

      <div className="relative z-[1] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {/* Icon tile — pixel-bordered to match the card */}
        <div
          className={cn(
            "w-12 h-12 pixel-border flex items-center justify-center shrink-0",
            iconTileBg
          )}
          aria-hidden
        >
          {hasStreak ? (
            <Flame className="w-6 h-6 text-amber-400" />
          ) : (
            <Sparkles className="w-6 h-6 text-indigo-400" />
          )}
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <div className={cn("font-pixel text-[9px] tracking-wider mb-2", microLabelColor)}>
            TODAY&rsquo;S MISSION
          </div>
          <h2
            id="todays-mission-heading"
            className="text-lg sm:text-xl font-bold text-white leading-tight tracking-tight"
          >
            {hasStreak ? (
              <>
                Keep the fire alive{" "}
                <span className="text-amber-400">&middot; {streak}-day streak</span>
              </>
            ) : (
              <>Begin your first streak</>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            {hasStreak
              ? "Complete one quest today to keep your streak burning. It only takes a few minutes."
              : "Finish a single quest today to ignite your streak. Tomorrow it gets stronger."}
          </p>
        </div>

        {/* CTA — chunky pixel-press button, matches Quest Board featured */}
        <Link
          href={href}
          className={cn(
            "shrink-0 w-full sm:w-auto pixel-focus outline-none",
            "transition-transform duration-100 hover:translate-y-0.5 active:translate-y-1"
          )}
        >
          <div
            className={cn(
              "w-full sm:w-auto px-5 py-3 flex items-center justify-center gap-2",
              "font-pixel text-[10px] tracking-wider",
              ctaPalette
            )}
          >
            <Sword className="w-4 h-4" aria-hidden />
            {hasStreak ? "CONTINUE THE QUEST" : "BEGIN TODAY'S QUEST"}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </div>
        </Link>
      </div>
    </motion.section>
  );
}
