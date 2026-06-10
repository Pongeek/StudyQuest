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

  const borderTone = hasDemons ? "text-purple-500/80" : "text-slate-700/60";
  const nailColor = hasDemons ? "bg-purple-400" : "bg-slate-700";
  const microLabelColor = hasDemons
    ? "text-purple-400/90"
    : "text-slate-500/80";
  const iconTileBg = hasDemons
    ? "bg-purple-500/15 text-purple-300"
    : "bg-slate-800/60 text-slate-500";
  const ctaPalette = hasDemons
    ? "bg-purple-500 text-white shadow-[0_4px_0_0_#581c87] hover:shadow-[0_2px_0_0_#581c87] active:shadow-[0_0_0_0_#581c87]"
    : "bg-slate-800 text-slate-400 shadow-[0_4px_0_0_#0f172a] hover:shadow-[0_2px_0_0_#0f172a] active:shadow-[0_0_0_0_#0f172a]";

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
        "relative card-alive overflow-hidden px-5 py-5 sm:px-6 sm:py-5",
        "pixel-border",
        borderTone,
        !hasDemons && "opacity-80"
      )}
    >
      {/* Dot-matrix texture — alive-pass depth */}
      <span aria-hidden className="absolute inset-0 hud-hero-texture pointer-events-none" />

      {/* Pixel nail corners */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5", nailColor)} />

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

        {/* CTA */}
        <Link
          href="/dashboard/grimoire"
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
