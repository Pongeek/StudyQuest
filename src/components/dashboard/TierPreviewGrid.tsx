import TierLevelFrame from "@/components/gamification/TierLevelFrame";
import { getLevelTierVisuals } from "@/lib/level-tier";
import { cn } from "@/lib/utils";

/**
 * Dev-only preview grid — renders all 6 tiers at sample levels so the
 * visual progression can be inspected without leveling up 49 times.
 * Mounted from the dashboard when the URL has `?tierPreview=1`.
 *
 * Showcases:
 *  - each tier's frame at its tier.min level
 *  - within-tier drift via 3 sample levels inside Apprentice (5/7/9)
 *  - the full progression: 1, 5, 10, 20, 35, 50
 */
const TIER_SAMPLES = [
  { level: 1, label: "NOVICE · LV.01" },
  { level: 4, label: "NOVICE · LV.04" },
  { level: 5, label: "APPRENTICE · LV.05" },
  { level: 7, label: "APPRENTICE · LV.07" },
  { level: 9, label: "APPRENTICE · LV.09" },
  { level: 10, label: "ADEPT · LV.10" },
  { level: 15, label: "ADEPT · LV.15" },
  { level: 19, label: "ADEPT · LV.19" },
  { level: 20, label: "EXPERT · LV.20" },
  { level: 27, label: "EXPERT · LV.27" },
  { level: 34, label: "EXPERT · LV.34" },
  { level: 35, label: "MASTER · LV.35" },
  { level: 42, label: "MASTER · LV.42" },
  { level: 49, label: "MASTER · LV.49" },
  { level: 50, label: "SAGE · LV.50" },
  { level: 60, label: "SAGE · LV.60" },
];

export default function TierPreviewGrid() {
  return (
    <section
      aria-labelledby="tier-preview-heading"
      className="rpg-card rounded-2xl p-5 sm:p-6"
    >
      <header className="mb-4">
        <h2
          id="tier-preview-heading"
          className="font-pixel text-[12px] tracking-widest text-amber-300 mb-1"
        >
          DEV · TIER PREVIEW
        </h2>
        <p className="text-xs text-slate-500">
          All six tiers rendered side-by-side. Drift across sub-levels visible
          inside each tier. Strip this from the dashboard before shipping.
        </p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
        {TIER_SAMPLES.map((sample) => {
          const visuals = getLevelTierVisuals(sample.level);
          return (
            <div
              key={sample.level}
              className={cn(
                "flex flex-col items-center text-center gap-2.5 px-2 py-3 rounded-lg",
                "border border-white/[0.05] bg-white/[0.01]",
                // Stitch v2 hover treatment — subtle lift + brighter border
                // so each tier card pops on hover in the dev preview grid.
                "transition-all duration-300 ease-out",
                "hover:scale-[1.04] hover:border-white/[0.12] hover:bg-white/[0.03] hover:-translate-y-0.5",
              )}
            >
              <TierLevelFrame level={sample.level} />
              <span className="font-pixel text-[9px] tracking-wider text-slate-400">
                {sample.label}
              </span>
              <span className="text-[10px] text-slate-600 tabular-nums">
                sat +{(visuals.saturationOffset * 100).toFixed(0)}% · α{" "}
                {visuals.glowAlpha.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
