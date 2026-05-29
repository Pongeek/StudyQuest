import { createServiceClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Target, Brain, Clock, Zap } from "lucide-react";

interface TodayStatsStripProps {
  /** DB user id (resolved from clerk_id by the parent dashboard page). */
  dbUserId: string;
}

/**
 * Slim "today" stats row under the dashboard hero. Different from the
 * hero stat grid (which shows LIFETIME totals) — this is the shape of
 * the CURRENT study day. Hides entirely when there's no activity yet
 * today so the dashboard stays clean on a fresh-morning visit
 * (TodaysMission handles the "go study" CTA pre-activity).
 *
 * Server component — parallel queries against the 3 completed-session
 * tables (quiz / boss / review), all filtered to `completed_at >=
 * today_midnight`. Mirrors the CourseStudyReport pattern.
 */
export default async function TodayStatsStrip({ dbUserId }: TodayStatsStripProps) {
  const supabase = createServiceClient();

  // Midnight UTC of today as ISO. Vercel runs UTC so this is the right
  // floor for the server-side query — the displayed "today" matches the
  // server's calendar day, which is consistent with how streak_freeze
  // and last_study_date were computed.
  const todayMidnight =
    new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";

  const [quizRes, bossRes, reviewRes] = await Promise.all([
    supabase
      .from("quiz_sessions")
      .select("started_at, completed_at, xp_earned, correct_count, question_count")
      .eq("user_id", dbUserId)
      .gte("completed_at", todayMidnight),
    supabase
      .from("boss_fight_sessions")
      .select("started_at, completed_at, xp_earned, correct_count, question_count")
      .eq("user_id", dbUserId)
      .gte("completed_at", todayMidnight),
    supabase
      .from("review_sessions")
      .select("started_at, completed_at, xp_earned, correct_count, question_count")
      .eq("user_id", dbUserId)
      .gte("completed_at", todayMidnight),
  ]);

  // Per-session minute cap (1 hour) so a session left open in a tab
  // overnight can't inflate today's total. Same pattern as
  // TopicMasteryPanel.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  function minutesOf(
    rows: Array<{ started_at?: string | null; completed_at?: string | null }> | null,
  ): number {
    if (!rows) return 0;
    let ms = 0;
    for (const r of rows) {
      if (!r.started_at || !r.completed_at) continue;
      const dur = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime();
      if (dur <= 0) continue;
      ms += Math.min(dur, ONE_HOUR_MS);
    }
    return Math.round(ms / 60000);
  }

  interface SessionRow {
    started_at?: string | null;
    completed_at?: string | null;
    xp_earned?: number | null;
    correct_count?: number | null;
    question_count?: number | null;
  }

  function sumNumeric(rows: SessionRow[] | null, field: keyof SessionRow): number {
    if (!rows) return 0;
    return rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
  }

  const allRows: SessionRow[] = [
    ...((quizRes.data as SessionRow[]) ?? []),
    ...((bossRes.data as SessionRow[]) ?? []),
    ...((reviewRes.data as SessionRow[]) ?? []),
  ];

  const totalQuestions = sumNumeric(allRows, "question_count");
  const totalCorrect = sumNumeric(allRows, "correct_count");
  const totalXp = sumNumeric(allRows, "xp_earned");
  const totalMinutes = minutesOf(allRows);

  // Hide when nothing studied today. TodaysMission already prompts
  // "go study" elsewhere; we don't want a row of 0s.
  if (totalQuestions === 0 && totalXp === 0) return null;

  const accuracyPct =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Accuracy color band — celebrates strong sessions, flags weak ones.
  const accuracyTone =
    accuracyPct >= 85
      ? "text-emerald-400"
      : accuracyPct >= 70
        ? "text-amber-400"
        : accuracyPct > 0
          ? "text-red-400"
          : "text-slate-500";

  return (
    <section aria-labelledby="today-stats-heading" className="rpg-card rounded-2xl p-4 relative overflow-hidden">
      {/* Indigo top accent line — ties to the hero card above */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      {/* Pixel nail corners */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400" />

      <div className="flex items-center justify-between mb-3">
        <h2
          id="today-stats-heading"
          className="font-pixel text-[9px] tracking-wider text-indigo-400"
        >
          TODAY · YOUR JOURNEY
        </h2>
        <p className="text-[10px] text-slate-600 tabular-nums">
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile
          icon={<Brain className="w-3.5 h-3.5" />}
          label="Questions"
          value={String(totalQuestions)}
          tone="text-white"
        />
        <Tile
          icon={<Target className="w-3.5 h-3.5" />}
          label="Accuracy"
          value={`${accuracyPct}%`}
          tone={accuracyTone}
        />
        <Tile
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Minutes"
          value={String(totalMinutes)}
          tone="text-white"
        />
        <Tile
          icon={<Zap className="w-3.5 h-3.5" />}
          label="XP earned"
          value={`+${totalXp}`}
          tone="text-amber-400"
        />
      </div>
    </section>
  );
}

interface TileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}

function Tile({ icon, label, value, tone }: TileProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2">
      <div className="w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0 text-slate-400">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-pixel text-[8px] tracking-wider text-slate-500 mb-0.5">
          {label.toUpperCase()}
        </div>
        <div className={cn("text-lg font-bold leading-none tabular-nums", tone)}>
          {value}
        </div>
      </div>
    </div>
  );
}
