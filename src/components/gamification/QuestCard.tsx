"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuestTier = "featured" | "priority" | "standard";

export interface QuestCardProps {
  topicId: string;
  topicTitle: string;
  courseName: string;
  href: string;
  masteryLevel: number;
  tier: QuestTier;
}

const HEBREW_RE = /[֐-׿]/;

function difficultyForMastery(masteryLevel: number): {
  level: number;
  roman: string;
  label: string;
} {
  if (masteryLevel === 0) return { level: 1, roman: "I", label: "UNCHARTED" };
  if (masteryLevel <= 1) return { level: 2, roman: "II", label: "CHALLENGING" };
  return { level: 3, roman: "III", label: "VETERAN" };
}

/**
 * A single quest tile — pixel-arcade redesign.
 *
 * - `featured` → indigo pixel border + CRT scanline overlay + pulsing
 *   "RECOMMENDED" pixel stamp + amber pixel-nail corners + indigo CTA
 * - `priority` → amber pixel border + amber CTA + amber pixel-nail corners
 * - `standard` → slate pixel border + indigo CTA + slate pixel-nail corners
 *
 * Difficulty rendered as "LVL.I/II/III" pixel chip in the top-left.
 * Whole card is a clickable Next.js Link. RTL-safe (Hebrew titles).
 */
export default function QuestCard({
  topicTitle,
  courseName,
  href,
  masteryLevel,
  tier,
}: QuestCardProps) {
  const isFeatured = tier === "featured";
  const isPriority = tier === "priority";
  const isRTL =
    HEBREW_RE.test(topicTitle || "") || HEBREW_RE.test(courseName || "");
  const { roman, label: difficultyLabel } = difficultyForMastery(masteryLevel);
  const reduceMotion = useReducedMotion();

  // Only the featured card keeps a colored full border — priority/standard
  // recede to neutral frames and carry their tier color in the nails, chip
  // and CTA tint instead, so the recommended quest is the one that pops.
  const borderColor = isFeatured ? "text-indigo-500" : "text-slate-700";
  const nailColor = isFeatured
    ? "bg-amber-400"
    : isPriority
    ? "bg-amber-400/80"
    : "bg-slate-600";
  const tierChipColor = isFeatured
    ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
    : isPriority
    ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
    : "bg-slate-700/40 text-slate-300 border-slate-600";
  const aliveRgb = isFeatured
    ? "99 102 241"
    : isPriority
    ? "245 158 11"
    : "100 116 139";

  return (
    <Link
      href={href}
      dir={isRTL ? "rtl" : "ltr"}
      style={{ ["--alive-rgb" as string]: aliveRgb }}
      className={cn(
        "group relative block h-full card-alive",
        "pixel-border",
        borderColor,
        "transition-transform duration-200",
        "hover:-translate-y-1 focus-visible:-translate-y-1",
        "pixel-focus outline-none"
      )}
    >
      {/* CRT scanlines on featured only */}
      {isFeatured && (
        <div
          aria-hidden
          className="pixel-scanlines absolute inset-0 opacity-40 pointer-events-none"
        />
      )}

      {/* Pixel "nails" — 4 small solid squares in the corners */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5", nailColor)} />

      {/* Pulsing RECOMMENDED stamp on featured */}
      {isFeatured && (
        <motion.div
          aria-hidden
          className="absolute -top-2 -right-2 z-10"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={
            reduceMotion
              ? { scale: 1, opacity: 1 }
              : { scale: [1, 1.06, 1], opacity: 1 }
          }
          transition={{
            scale: reduceMotion
              ? { duration: 0.3 }
              : { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 0.3 },
          }}
        >
          <div
            className={cn(
              "font-pixel text-[8px] leading-none tracking-wider",
              "bg-amber-500 text-slate-950 px-2 py-1.5 -rotate-6",
              "shadow-[2px_2px_0_0_rgba(0,0,0,0.6)]",
              "border border-amber-300"
            )}
          >
            RECOMMENDED
          </div>
        </motion.div>
      )}

      <div className="relative z-[1] p-5 pt-6 flex flex-col h-full">
        {/* Tier chip */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span
            className={cn(
              "font-pixel text-[9px] leading-none tracking-wider",
              "border px-2 py-1.5",
              tierChipColor
            )}
          >
            LVL.{roman}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500">
            {difficultyLabel}
          </span>
        </div>

        {/* Title + course */}
        <div className="flex-1">
          <h3
            className={cn(
              "text-white leading-snug mb-1.5 line-clamp-2 tracking-tight font-bold",
              isFeatured ? "text-[17px]" : "text-base"
            )}
          >
            {topicTitle}
          </h3>
          <p className="text-[12px] text-slate-500 line-clamp-1">{courseName}</p>
        </div>

        {/* CTA — only the featured quest keeps the chunky solid pixel-press
            button (it's the page's recommended action). Priority/standard
            demote to quiet tinted buttons so the board has one obvious move. */}
        <div className="mt-5">
          <div
            className={cn(
              "w-full px-4 py-2.5 flex items-center justify-center gap-1.5",
              "font-pixel text-[10px] tracking-wider",
              isFeatured
                ? "bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f] transition-transform duration-100 group-hover:translate-y-0.5 group-active:translate-y-1 group-hover:shadow-[0_2px_0_0_#78350f] group-active:shadow-[0_0_0_0_#78350f]"
                : isPriority
                ? "rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-200 transition-colors duration-150 group-hover:bg-amber-500/20 group-hover:border-amber-400/60"
                : "rounded-lg border border-indigo-400/40 bg-indigo-500/10 text-indigo-200 transition-colors duration-150 group-hover:bg-indigo-500/20 group-hover:border-indigo-400/60"
            )}
          >
            <Target className="w-3 h-3" aria-hidden />
            {isFeatured ? "BEGIN QUEST" : "ACCEPT QUEST"}
          </div>
        </div>
      </div>
    </Link>
  );
}
