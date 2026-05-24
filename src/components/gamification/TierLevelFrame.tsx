import { cn } from "@/lib/utils";
import { getLevelTierVisuals, type LevelTierVisuals } from "@/lib/level-tier";

/**
 * Tier-aware HUD level frame. Drop-in replacement for the bare
 * `.hud-level-frame` chrome used in the dashboard hero, profile hero, and
 * landing hero. Reads tier vocabulary from `getLevelTierVisuals(level)`
 * and:
 *
 *   - applies the tier-specific palette class (`.tier-apprentice` etc.)
 *   - sets `--tier-saturation` and `--tier-glow-alpha` inline so each
 *     individual level still drifts subtly within the tier
 *   - layers the right decoration spans (sparks / laurels / crown / flames /
 *     rune ring) based on tier
 *   - applies the glow-pulse / halo / breathe animation class
 *
 * The label ("LVL") and the level number layout stay identical to the
 * legacy markup, so existing CSS positions still apply. Sage swaps the
 * numeral to `.text-gradient-epic` for the rotating amber→violet gradient.
 */
interface TierLevelFrameProps {
  level: number;
  /** Override the visuals (used by the dev-only tier preview grid). */
  visuals?: LevelTierVisuals;
  className?: string;
}

export default function TierLevelFrame({
  level,
  visuals: visualsOverride,
  className,
}: TierLevelFrameProps) {
  const visuals = visualsOverride ?? getLevelTierVisuals(level);
  const isSage = visuals.tier === "sage";

  return (
    <div
      className={cn(
        "hud-level-frame",
        visuals.tierClass,
        visuals.glow !== "none" && `tier-glow-${visuals.glow}`,
        className,
      )}
      style={
        {
          // Saturation + glow alpha drift across the within-tier range.
          // CSS reads these via var() in .hud-level-frame's box-shadow +
          // filter, so the visual difference between lv 5 and lv 9 of
          // Apprentice is continuous, not discrete.
          ["--tier-saturation" as string]: 1 + visuals.saturationOffset,
          ["--tier-glow-alpha" as string]: visuals.glowAlpha,
        } as React.CSSProperties
      }
      aria-label={`Level ${level} — ${visuals.tierTitle}`}
    >
      {/* Master + Sage carry a faint scanlines overlay across the inner
          area. Sits between the inner dashed border and the numeral. */}
      {(visuals.tier === "master" || visuals.tier === "sage") && (
        <span aria-hidden className="tier-scanlines" />
      )}

      {/* Apprentice — 4 corner sparks. */}
      {visuals.decoration === "sparks" && (
        <>
          <span aria-hidden className="tier-spark tier-spark--tl" />
          <span aria-hidden className="tier-spark tier-spark--tr" />
          <span aria-hidden className="tier-spark tier-spark--bl" />
          <span aria-hidden className="tier-spark tier-spark--br" />
        </>
      )}

      {/* Adept — side laurel marks. 3 pips per side, stacked vertically. */}
      {visuals.decoration === "laurel" && (
        <>
          <span aria-hidden className="tier-laurel tier-laurel--left">
            <span className="tier-laurel-pip" />
            <span className="tier-laurel-pip" />
            <span className="tier-laurel-pip" />
          </span>
          <span aria-hidden className="tier-laurel tier-laurel--right">
            <span className="tier-laurel-pip" />
            <span className="tier-laurel-pip" />
            <span className="tier-laurel-pip" />
          </span>
        </>
      )}

      {/* Expert — 3-tooth pixel crown above the frame. */}
      {visuals.decoration === "crown" && (
        <span aria-hidden className="tier-crown">
          <span className="tier-crown-tooth tier-crown-tooth--short" />
          <span className="tier-crown-tooth tier-crown-tooth--tall" />
          <span className="tier-crown-tooth tier-crown-tooth--short" />
        </span>
      )}

      {/* Master — flame edges at all 4 corners. */}
      {visuals.decoration === "flames" && (
        <>
          <span aria-hidden className="tier-flame tier-flame--tl" />
          <span aria-hidden className="tier-flame tier-flame--tr" />
          <span aria-hidden className="tier-flame tier-flame--bl" />
          <span aria-hidden className="tier-flame tier-flame--br" />
        </>
      )}

      {/* Sage — animated rune ring rotating around the frame. */}
      {visuals.decoration === "runes" && (
        <span aria-hidden className="tier-rune-ring">
          {/* Four runes at cardinal points. The glyph set is intentionally
              modest — three Norse-flavored characters + an asterisk — so
              the ring reads as "ancient" without straying into childish
              fantasy emoji territory. */}
          <span className="tier-rune tier-rune--n">ᚱ</span>
          <span className="tier-rune tier-rune--e">ᚦ</span>
          <span className="tier-rune tier-rune--s">ᚷ</span>
          <span className="tier-rune tier-rune--w">✦</span>
        </span>
      )}

      {/* "LVL" micro-label */}
      <span className="hud-level-label">LVL</span>

      {/* Numeral — Sage uses gradient text via existing utility. */}
      <span className={cn("hud-level-number", isSage && "text-gradient-epic")}>
        {level}
      </span>
    </div>
  );
}
