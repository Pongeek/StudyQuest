import Link from "next/link";
import { Star, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const HEBREW_RE = /[\u0590-\u05FF]/;

function difficultyForMastery(masteryLevel: number): {
  stars: number;
  label: string;
} {
  if (masteryLevel === 0) return { stars: 1, label: "Uncharted" };
  if (masteryLevel <= 1) return { stars: 2, label: "Challenging" };
  return { stars: 3, label: "Veteran" };
}

/**
 * A single quest tile on the Quest Board.
 *
 * - `featured` (the recommended next action) → foil shimmer + pulse-ring CTA + tier ribbon
 * - `priority` (weak topics) → amber accent, no foil
 * - `standard` (new / unattempted) → indigo accent
 */
export default function QuestCard({
  topicTitle,
  courseName,
  href,
  masteryLevel,
  tier,
}: QuestCardProps) {
  const isFeatured = tier === "featured";
  const isPriority = tier === "priority" || tier === "featured";
  const isRTL =
    HEBREW_RE.test(topicTitle || "") || HEBREW_RE.test(courseName || "");
  const { stars, label: difficultyLabel } = difficultyForMastery(masteryLevel);

  return (
    <article
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "rpg-card rounded-2xl p-5 flex flex-col justify-between",
        "tilt-card relative h-full overflow-hidden",
        isFeatured && "foil-shimmer",
        !isFeatured && isPriority && "ring-1 ring-amber-500/20",
      )}
    >
      <div className="relative z-10">
        {/* Header row: difficulty stars + featured ribbon */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-3 h-3",
                  i < stars
                    ? "text-amber-400 fill-amber-400"
                    : "text-slate-700",
                )}
              />
            ))}
            <span className="text-[11px] uppercase tracking-wider font-medium text-slate-500 ml-1.5">
              {difficultyLabel}
            </span>
          </div>
          {isFeatured && (
            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-amber-400">
              <Sparkles className="w-3 h-3" />
              Featured
            </span>
          )}
        </div>

        <h3
          className={cn(
            "font-semibold text-white leading-snug mb-1 line-clamp-2 tracking-tight",
            isFeatured ? "text-lg" : "text-base",
          )}
        >
          {topicTitle}
        </h3>
        <p className="text-[13px] text-slate-500 line-clamp-1">
          {courseName}
        </p>
      </div>

      <Link href={href} className="mt-5 relative z-10 block">
        <Button
          size="lg"
          className={cn(
            "w-full gap-1.5 font-medium",
            isPriority
              ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
              : "bg-indigo-500 hover:bg-indigo-400 text-white",
          )}
        >
          <Target className="w-4 h-4" />
          {isFeatured ? "Begin Quest" : "Accept Quest"}
        </Button>
      </Link>
    </article>
  );
}
