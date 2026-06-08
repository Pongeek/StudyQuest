// ─── TruesightSection ─────────────────────────────────────────────────────────
// "Truesight" on the profile Overview: how well the learner's self-reported
// Confidence matches their measured correctness (their Calibration). Three
// accuracy bars — Guessed / Unsure / Confident — in the familiar red/amber/
// emerald confidence tones, with a cold-start nudge until enough answers are
// rated. See CONTEXT.md → Calibration.
//
// Server component — purely presentational. All math lives in the pure
// `computeCalibration` helper (lib/calibration.ts); this only renders the view
// model: the three bars, the signal chips (Overconfident stumbles / Lucky
// guesses), the plain verdict line, and the Overconfident drill-down to the
// blind-spot topics (a native <details>, each row linking to its topic page).

import Link from "next/link";
import {
  Eye,
  AlertTriangle,
  Dices,
  ShieldCheck,
  TrendingUp,
  Scale,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CountUp from "@/components/profile/CountUp";
import ProgressFill from "@/components/profile/ProgressFill";
import {
  MIN_RATED,
  MIN_PER_TIER,
  type CalibrationView,
  type ConfidenceTier,
  type VerdictKey,
  type StumbleTopic,
} from "@/lib/calibration";

/** Top blind-spot topics shown inside the expanded Overconfident drill-down. */
const MAX_STUMBLE_TOPICS = 5;

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

/**
 * The two named signal chips, each toned to the confidence tier it lives in so
 * it visually echoes its bar above: an Overconfident stumble is a *confident*
 * miss (emerald), a Lucky guess is a *guessed* hit (red). Glossary terms verbatim.
 */
const SIGNAL_META = {
  overconfident: {
    icon: AlertTriangle,
    label: "Overconfident stumbles",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    text: "text-emerald-400",
  },
  lucky: {
    icon: Dices,
    label: "Lucky guesses",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    text: "text-red-400",
  },
} as const;

/** Chrome copy + tone per verdict key — the helper only hands us the key. */
const VERDICT_META: Record<
  VerdictKey,
  { icon: LucideIcon; copy: string; text: string; border: string; bg: string }
> = {
  "well-calibrated": {
    icon: ShieldCheck,
    copy: "Your gut is trustworthy — your confidence tracks reality.",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
  },
  overconfident: {
    icon: AlertTriangle,
    copy: "You feel sure on answers you get wrong — mind the blind spots.",
    text: "text-amber-300",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
  },
  underconfident: {
    icon: TrendingUp,
    copy: "You know more than you think — trust your instinct more.",
    text: "text-indigo-300",
    border: "border-indigo-500/30",
    bg: "bg-indigo-500/5",
  },
  mixed: {
    icon: Scale,
    copy: "Your read is uneven — sometimes too sure, sometimes too modest.",
    text: "text-purple-300",
    border: "border-purple-500/30",
    bg: "bg-purple-500/5",
  },
};

/** The icon + count + label trio shared by the plain chip and the drill-down summary. */
function ChipContent({
  meta,
  count,
}: {
  meta: (typeof SIGNAL_META)[keyof typeof SIGNAL_META];
  count: number;
}) {
  const Icon = meta.icon;
  return (
    <>
      <Icon className={cn("w-4 h-4 shrink-0", meta.text)} aria-hidden />
      <span className={cn("font-bold tabular-nums text-lg", meta.text)}>
        <CountUp value={count} animKey={`truesight-signal-${meta.label}`} />
      </span>
      <span className="text-xs font-medium text-slate-400 leading-tight">
        {meta.label}
      </span>
    </>
  );
}

function SignalChip({
  meta,
  count,
}: {
  meta: (typeof SIGNAL_META)[keyof typeof SIGNAL_META];
  count: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
        meta.border,
        meta.bg
      )}
    >
      <ChipContent meta={meta} count={count} />
    </div>
  );
}

/** One blind-spot topic inside the expanded drill-down — links to the topic page. */
function StumbleTopicRow({ topic }: { topic: StumbleTopic }) {
  const canLink = Boolean(topic.courseId && topic.topicId);
  const label = `${topic.topicTitle}: ${topic.count} overconfident ${
    topic.count === 1 ? "stumble" : "stumbles"
  }${canLink ? " — open topic" : ""}`;

  const inner = (
    <>
      <span className="text-sm text-slate-300 truncate">{topic.topicTitle}</span>
      <span className="ms-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-bold tabular-nums text-emerald-400/90">
        {topic.count}×
        {canLink && (
          <ChevronRight
            className="w-3.5 h-3.5 text-slate-500 rtl:rotate-180"
            aria-hidden
          />
        )}
      </span>
    </>
  );

  if (!canLink) {
    return (
      <li
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
        aria-label={label}
      >
        {inner}
      </li>
    );
  }
  return (
    <li>
      <Link
        href={`/dashboard/courses/${topic.courseId}/topics/${topic.topicId}`}
        aria-label={label}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors pixel-focus"
      >
        {inner}
      </Link>
    </li>
  );
}

/**
 * The Overconfident-stumbles signal. With no stumbles it's a plain (good-news)
 * chip — no expand control. With stumbles it expands via a native <details> to
 * the top blind-spot topics, each linking out so the learner can act in one tap.
 */
function OverconfidentSignal({
  count,
  byTopic,
}: {
  count: number;
  byTopic: StumbleTopic[];
}) {
  const meta = SIGNAL_META.overconfident;

  if (count === 0 || byTopic.length === 0) {
    return <SignalChip meta={meta} count={count} />;
  }

  const top = byTopic.slice(0, MAX_STUMBLE_TOPICS);
  const remaining = byTopic.length - top.length;

  return (
    <details className="group rounded-xl border border-emerald-500/30 bg-emerald-500/5 [&_summary]:list-none">
      <summary className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer rounded-xl select-none pixel-focus">
        <ChipContent meta={meta} count={count} />
        <ChevronDown
          className="ms-auto w-4 h-4 shrink-0 text-emerald-400/70 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <ul className="px-2.5 pb-2.5 pt-0.5 space-y-0.5">
        {top.map((t) => (
          <StumbleTopicRow key={t.topicId} topic={t} />
        ))}
        {remaining > 0 && (
          <li className="stat-label text-slate-600 px-2 pt-1">
            +{remaining} more {remaining === 1 ? "topic" : "topics"}
          </li>
        )}
      </ul>
    </details>
  );
}

function VerdictLine({ verdict }: { verdict: VerdictKey }) {
  const meta = VERDICT_META[verdict];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3.5 py-3",
        meta.border,
        meta.bg
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", meta.text)} aria-hidden />
      <p className={cn("text-sm font-semibold leading-snug", meta.text)}>
        {meta.copy}
      </p>
    </div>
  );
}

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

          {/* Named signal callouts — the two cases that cost or flatter you.
              The Overconfident chip expands to the blind-spot topics behind it. */}
          <div className="space-y-2.5 pt-1">
            <OverconfidentSignal
              count={view.overconfidentStumbles.count}
              byTopic={view.overconfidentStumbles.byTopic}
            />
            <SignalChip
              meta={SIGNAL_META.lucky}
              count={view.luckyGuesses.count}
            />
          </div>

          {/* Plain takeaway. Only present once the helper leaves cold-start. */}
          {view.verdict && <VerdictLine verdict={view.verdict} />}
        </div>
      )}
    </div>
  );
}
