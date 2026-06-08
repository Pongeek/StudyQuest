// ─── TruesightSection ─────────────────────────────────────────────────────────
// "Truesight" on the profile Overview: how well the learner's self-reported
// Confidence matches their measured correctness (their Calibration). Three
// accuracy bars — Guessed / Unsure / Confident — in the familiar red/amber/
// emerald confidence tones, with a cold-start nudge until enough answers are
// rated. See CONTEXT.md → Calibration.
//
// Server component — purely presentational. All math lives in the pure
// `computeCalibration` helper (lib/calibration.ts); this only renders the view
// model. Signal chips (Overconfident stumbles / Lucky guesses) + the verdict
// land in #33; the blind-spot topic drill-down in #34.

import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import CountUp from "@/components/profile/CountUp";
import ProgressFill from "@/components/profile/ProgressFill";
import {
  MIN_RATED,
  MIN_PER_TIER,
  type CalibrationView,
  type ConfidenceTier,
} from "@/lib/calibration";

/** Per-tier copy + the red/amber/emerald confidence tones used in the quiz. */
const TIER_META: Record<
  ConfidenceTier,
  { label: string; text: string; fill: string }
> = {
  guessed: { label: "GUESSED", text: "text-red-400", fill: "bg-red-500" },
  unsure: { label: "UNSURE", text: "text-amber-400", fill: "bg-amber-500" },
  confident: {
    label: "CONFIDENT",
    text: "text-emerald-400",
    fill: "bg-emerald-500",
  },
};

function TierBar({
  tier,
}: {
  tier: CalibrationView["tiers"][number];
}) {
  const meta = TIER_META[tier.confidence];

  if (tier.lowData) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span
            className={cn(
              "font-pixel text-[10px] tracking-wider opacity-50",
              meta.text
            )}
          >
            {meta.label}
          </span>
          <span className="font-pixel text-[9px] tracking-wider text-slate-500">
            LOW DATA
          </span>
        </div>
        {/* Empty track — no misleading percentage off a handful of answers. */}
        <div className="h-2 rounded-full bg-slate-800/60" aria-hidden />
        <div className="stat-label text-slate-600 mt-1.5">
          {tier.total}/{MIN_PER_TIER} rated to unlock
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className={cn("font-pixel text-[10px] tracking-wider", meta.text)}>
          {meta.label}
        </span>
        <span className={cn("font-bold tabular-nums text-sm", meta.text)}>
          <CountUp
            value={tier.accuracyPct}
            animKey={`truesight-${tier.confidence}`}
            suffix="%"
          />
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-slate-800/80 overflow-hidden"
        role="progressbar"
        aria-valuenow={tier.accuracyPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${meta.label}: right ${tier.correct} of ${tier.total} times, ${tier.accuracyPct}% accuracy`}
      >
        <ProgressFill
          pct={Math.max(tier.accuracyPct, 4)}
          animKey={`truesight-bar-${tier.confidence}`}
          className={meta.fill}
        />
      </div>
      <div className="stat-label text-slate-500 mt-1.5">
        {tier.correct}/{tier.total} correct
      </div>
    </div>
  );
}

export default function TruesightSection({ view }: { view: CalibrationView }) {
  const remaining = Math.max(MIN_RATED - view.totalRated, 0);

  return (
    <div className="rpg-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
      {/* Purple accent line + pixel nails — "magical insight" identity, distinct
          from the indigo Lifetime card directly below it. */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-purple-400 z-[1]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-purple-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-purple-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-purple-400 z-[1]" />

      <header className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 pixel-border bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
          <Eye className="w-4 h-4" />
        </div>
        <div>
          <div className="font-pixel text-[9px] tracking-wider text-purple-400/90">
            CALIBRATION
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
            Truesight
          </h2>
        </div>
      </header>

      {view.state === "cold-start" ? (
        <div className="text-center py-6">
          <Eye className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">
            Truesight is still focusing
          </p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto">
            Rate your confidence on{" "}
            <span className="text-purple-300 font-semibold tabular-nums">
              {remaining}
            </span>{" "}
            more {remaining === 1 ? "answer" : "answers"} to reveal how well your
            gut matches reality.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {view.tiers.map((tier) => (
            <TierBar key={tier.confidence} tier={tier} />
          ))}
        </div>
      )}
    </div>
  );
}
