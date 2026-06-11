"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Skull, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface GrimoireWidgetProps {
  demonCount: number;
}

/**
 * Mistake Grimoire dashboard widget.
 *
 * Tier A (full pixel) treatment to match Today's Mission + Quest Board:
 *   - .pixel-border (purple when demons exist; muted slate when clear)
 *   - 4 pixel-nail corners (purple only when active so the "clear" state
 *     reads quieter — same restraint pattern as the rest of the dashboard)
 *   - pixel-font MISTAKE GRIMOIRE micro-label
 *   - pixel-bordered count chip ({N} DEMONS)
 *   - chunky purple pixel-shadow CTA when demons are active
 */
export default function GrimoireWidget({ demonCount }: GrimoireWidgetProps) {
  const reduceMotion = useReducedMotion();
  const hasDemons = demonCount > 0;

  const nailColor = hasDemons ? "bg-purple-400/80" : "bg-slate-700";
  const accentLine = hasDemons
    ? "bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"
    : "bg-gradient-to-r from-transparent via-slate-600/30 to-transparent";
  const microLabelColor = hasDemons
    ? "text-purple-400/90"
    : "text-slate-500/80";
  const iconTileBg = hasDemons
    ? "bg-purple-500/15 text-purple-300"
    : "bg-slate-800/60 text-slate-500";
  // Quiet CTA — the grimoire is a side quest, not the page's next action.
  // Tinted fill + hairline border instead of a solid chunky button.
  const ctaPalette = hasDemons
    ? "border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/60"
    : "border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]";

  return (
    <motion.section
      aria-labelledby="grimoire-heading"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        ["--alive-rgb" as string]: hasDemons ? "168 85 247" : "100 116 139",
      }}
      className={cn(
        "relative rpg-card card-alive widget-elev rounded-2xl overflow-hidden px-5 py-5 sm:px-6 sm:py-5",
        !hasDemons && "opacity-80"
      )}
    >
      {/* Dot-matrix texture — alive-pass depth */}
      <span aria-hidden className="absolute inset-0 hud-hero-texture pointer-events-none rounded-2xl" />

      {/* Top accent line — semantic color signal, replaces the full border */}
      <div aria-hidden className={cn("absolute top-0 inset-x-0 h-0.5", accentLine)} />

      {/* Pixel nail corners */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[1]", nailColor)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[1]", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[1]", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[1]", nailColor)} />

      <div className="relative z-[1] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
        {/* Icon tile — pixel-bordered to match the card */}
        <div
          className={cn(
            "w-12 h-12 pixel-border flex items-center justify-center shrink-0 text-xl",
            iconTileBg
          )}
          aria-hidden
        >
          📕
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-pixel text-[9px] tracking-wider mb-2 flex items-center gap-2",
              microLabelColor
            )}
          >
            MISTAKE GRIMOIRE
            {hasDemons && (
              <>
                <span className="text-slate-700">&middot;</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 pixel-border text-purple-300 text-[8px]">
                  <Skull className="w-2.5 h-2.5" aria-hidden />
                  {demonCount} DEMON{demonCount !== 1 ? "S" : ""}
                </span>
              </>
            )}
          </div>
          <h2
            id="grimoire-heading"
            className="text-base sm:text-lg font-bold text-white leading-tight tracking-tight"
          >
            {hasDemons ? (
              <>
                Slay the demons that haunt you
              </>
            ) : (
              <>The grimoire is clear</>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            {hasDemons
              ? "Questions you've failed multiple times wait to be conquered. Settle the score."
              : "No repeated failures haunting your sessions. Keep your edge sharp."}
          </p>
        </div>

        {/* CTA — quiet tinted button (side-quest volume) */}
        <Link
          href="/dashboard/grimoire"
          className="shrink-0 w-full sm:w-auto pixel-focus outline-none"
        >
          <div
            className={cn(
              "w-full sm:w-auto px-5 py-2.5 rounded-lg flex items-center justify-center gap-2",
              "font-pixel text-[10px] tracking-wider transition-colors duration-150",
              ctaPalette
            )}
          >
            {hasDemons ? (
              <>
                <Skull className="w-4 h-4" aria-hidden />
                OPEN GRIMOIRE
                <ArrowRight className="w-4 h-4" aria-hidden />
              </>
            ) : (
              <>
                <Check className="w-4 h-4" aria-hidden />
                ALL CLEAR
              </>
            )}
          </div>
        </Link>
      </div>
    </motion.section>
  );
}
