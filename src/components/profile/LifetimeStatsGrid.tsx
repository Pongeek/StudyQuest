// ─── LifetimeStatsGrid ────────────────────────────────────────────────────────
// The "character sheet" lifetime stats on the profile Overview. Chosen to NOT
// overlap the hero (Total XP / Streak / Sessions / Trophies): Questions answered,
// overall accuracy, topics mastered, and capped time studied.
//
// Server component — purely presentational. Count-up animation is the separate
// polish slice (#25).

import { ListChecks, Target, Crown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import CountUp from "@/components/profile/CountUp";

interface Props {
  questionsAnswered: number;
  accuracyPct: number;
  topicsMastered: number;
  timeStudiedMin: number;
}

type Accent = "amber" | "emerald" | "purple" | "indigo";

const ACCENT: Record<Accent, { line: string; label: string }> = {
  amber: { line: "via-amber-400/50", label: "text-amber-400" },
  emerald: { line: "via-emerald-400/50", label: "text-emerald-400" },
  purple: { line: "via-purple-400/50", label: "text-purple-400" },
  indigo: { line: "via-indigo-400/50", label: "text-indigo-400" },
};

function StatTile({
  label,
  value,
  sub,
  accent,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  accent: Accent;
  Icon: typeof Target;
}) {
  const tone = ACCENT[accent];
  return (
    <div className="relative px-3 py-3 bg-slate-950/40 rounded-lg overflow-hidden">
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent",
          tone.line
        )}
      />
      <div className={cn("stat-label flex items-center gap-1.5", tone.label)}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="font-bold text-white text-2xl leading-none tracking-tight tabular-nums mt-2">
        {value}
      </div>
      <div className="stat-label text-slate-500 mt-2 truncate">{sub}</div>
    </div>
  );
}

export default function LifetimeStatsGrid({
  questionsAnswered,
  accuracyPct,
  topicsMastered,
  timeStudiedMin,
}: Props) {
  return (
    <div className="rpg-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />

      <header className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 pixel-border bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
          <ListChecks className="w-4 h-4" />
        </div>
        <div>
          <div className="font-pixel text-[9px] tracking-wider text-indigo-400/90">
            CHRONICLE OF DEEDS
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
            Lifetime Stats
          </h2>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile
          label="QUESTIONS"
          value={<CountUp value={questionsAnswered} animKey="life-questions" />}
          sub="answered"
          accent="amber"
          Icon={ListChecks}
        />
        <StatTile
          label="ACCURACY"
          value={<CountUp value={accuracyPct} animKey="life-accuracy" suffix="%" />}
          sub="all-time correct"
          accent="emerald"
          Icon={Target}
        />
        <StatTile
          label="MASTERED"
          value={<CountUp value={topicsMastered} animKey="life-mastered" />}
          sub="at master tier"
          accent="purple"
          Icon={Crown}
        />
        <StatTile
          label="TIME"
          value={<CountUp value={timeStudiedMin} animKey="life-time" mode="duration" />}
          sub="time studied"
          accent="indigo"
          Icon={Clock}
        />
      </div>
    </div>
  );
}
