import { getLevelTitle, LEVEL_TIERS } from "@/lib/xp";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  level: number;
  /** Visual size of the badge */
  size?: "sm" | "md" | "lg";
  /** Show the "Level N · Class" label beside the hex shield */
  showTitle?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<LevelBadgeProps["size"]>, {
  badge: string;
  numeral: string;
  caption: string;
  title: string;
}> = {
  sm: {
    badge: "w-9 h-10",
    numeral: "text-base",
    caption: "text-xs",
    title: "text-sm",
  },
  md: {
    badge: "w-12 h-14",
    numeral: "text-xl",
    caption: "text-xs",
    title: "text-lg",
  },
  lg: {
    badge: "w-16 h-[72px]",
    numeral: "text-3xl",
    caption: "text-xs",
    title: "text-2xl",
  },
};

/** Index of the level tier in `LEVEL_TIERS`. Higher = more ornate. */
function tierIndexFor(level: number): number {
  const i = LEVEL_TIERS.findIndex((t) => level >= t.min && level <= t.max);
  return i < 0 ? 0 : i;
}

/**
 * Hexagonal level badge with optional RPG class title.
 *
 * - Adept (Lv 10+) and above get the holographic `.foil-shimmer` treatment.
 * - Numerals and class title use the display font for that "legendary card" feel.
 */
export default function LevelBadge({
  level,
  size = "md",
  showTitle = true,
  className,
}: LevelBadgeProps) {
  const sz = SIZE_CLASSES[size];
  const title = getLevelTitle(level);
  const tier = tierIndexFor(level);
  const isElite = tier >= 2; // Adept and above

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div
        className={cn(
          "game-badge shrink-0",
          isElite && "foil-shimmer",
          sz.badge,
        )}
        aria-label={`Level ${level}, ${title}`}
        role="img"
      >
        <span
          className={cn(
            "font-bold leading-none text-amber-400 tabular-nums tracking-tight",
            sz.numeral,
          )}
        >
          {level}
        </span>
      </div>

      {showTitle && (
        <div className="min-w-0">
          <div
            className={cn(
              "tier-ribbon text-amber-400/70",
              sz.caption,
            )}
          >
            Level {level}
          </div>
          <div
            className={cn(
              "font-semibold leading-none text-white truncate tracking-tight",
              sz.title,
            )}
          >
            {title}
          </div>
        </div>
      )}
    </div>
  );
}
