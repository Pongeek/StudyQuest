import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  Target,
  Clock,
  Swords,
  AlertTriangle,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
} from "lucide-react";
import StumbleRegenerateButton from "@/components/course/StumbleRegenerateButton";
import MarkdownInline from "@/components/quiz/MarkdownInline";

interface TopicMasteryPanelProps {
  topicId: string;
  courseId: string;
  /** DB user id (resolved from clerk_id by the parent page). */
  dbUserId: string;
}

interface SessionRow {
  id: string;
  started_at: string;
  completed_at: string;
  score_pct: number;
  question_count: number;
  correct_count: number;
  xp_earned: number;
}

interface QuestionRow {
  id: string;
  content: string;
  /** When set, the question has been soft-replaced and should NOT count as
   *  a stumble anymore (the student regenerated it). */
  replaced_at: string | null;
}

interface AnswerRow {
  question_id: string;
  ai_score: number | null;
  answered_at: string;
  user_answer: string;
  questions: QuestionRow | QuestionRow[] | null;
}

interface FailedQuestion {
  questionId: string;
  content: string;
  failures: number;
  attempts: number;
  lastAttemptAt: string;
}

/**
 * Per-topic mastery / quiz-history view.
 *
 * Sits below the Mastery Path tier visual on the topic detail page and
 * surfaces the per-topic data that used to be invisible (you only saw the
 * current tier and last 3 sessions). Sections:
 *
 *   1. Activity stat tiles — total questions, accuracy, time on topic,
 *      session count
 *   2. Score sparkline — last 10 sessions, oldest → newest, with trend
 *   3. Failed-question heatmap — questions failed 2+ times, collapsible
 *      via <details> so the panel stays compact by default
 *   4. Quiz history — up to 10 most recent sessions, each links to its
 *      review page
 *
 * Renders null when there's no quiz activity yet — the parent page already
 * shows a "start your quest" CTA in that case.
 */
export default async function TopicMasteryPanel({
  topicId,
  courseId,
  dbUserId,
}: TopicMasteryPanelProps) {
  const supabase = createServiceClient();

  // 1. All completed quiz sessions for this topic, newest first.
  const { data: sessionsRaw } = await supabase
    .from("quiz_sessions")
    .select(
      "id, started_at, completed_at, score_pct, question_count, correct_count, xp_earned"
    )
    .eq("user_id", dbUserId)
    .eq("topic_id", topicId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(50);

  const sessions = (sessionsRaw ?? []) as SessionRow[];
  if (sessions.length === 0) return null;

  // 2. All quiz answers across those sessions — needed for the failed
  //    questions heatmap. Joining `questions` inline avoids a second round-trip.
  const sessionIds = sessions.map((s) => s.id);
  const { data: answersRaw } = await supabase
    .from("quiz_answers")
    .select(
      "question_id, ai_score, answered_at, user_answer, questions(id, content, replaced_at)"
    )
    .in("session_id", sessionIds);

  const answers = (answersRaw ?? []) as unknown as AnswerRow[];

  // Aggregate failures per question (ai_score < 0.5 = failure).
  const byQuestion = new Map<
    string,
    { content: string; failures: number; attempts: number; lastAttemptAt: string }
  >();
  for (const a of answers) {
    const q = Array.isArray(a.questions) ? a.questions[0] : a.questions;
    if (!q) continue;
    // Skip questions the student has soft-replaced — they're no longer the
    // question being asked, so their historical fails are stale data.
    if (q.replaced_at) continue;
    let row = byQuestion.get(a.question_id);
    if (!row) {
      row = {
        content: q.content,
        failures: 0,
        attempts: 0,
        lastAttemptAt: a.answered_at,
      };
      byQuestion.set(a.question_id, row);
    }
    row.attempts += 1;
    if ((a.ai_score ?? 0) < 0.5) row.failures += 1;
    if (a.answered_at > row.lastAttemptAt) row.lastAttemptAt = a.answered_at;
  }
  const failedQuestions: FailedQuestion[] = Array.from(byQuestion.entries())
    .filter(([, v]) => v.failures >= 2)
    .map(([id, v]) => ({ questionId: id, ...v }))
    .sort((a, b) => b.failures - a.failures || b.attempts - a.attempts)
    .slice(0, 8);

  // ── Activity totals ────────────────────────────────────────────────────
  let questionsAttempted = 0;
  let questionsCorrect = 0;
  let totalSeconds = 0;
  for (const s of sessions) {
    questionsAttempted += s.question_count || 0;
    questionsCorrect += s.correct_count || 0;
    const startMs = new Date(s.started_at).getTime();
    const endMs = new Date(s.completed_at).getTime();
    if (endMs > startMs) {
      const sessionSec = Math.min((endMs - startMs) / 1000, 60 * 60); // cap 1h per session
      totalSeconds += sessionSec;
    }
  }
  const accuracy =
    questionsAttempted > 0
      ? Math.round((questionsCorrect / questionsAttempted) * 100)
      : 0;
  const totalMinutes = Math.round(totalSeconds / 60);
  const sessionCount = sessions.length;

  // ── Sparkline — last 10 sessions, oldest → newest ─────────────────────
  const sparkSessions = sessions.slice(0, 10).reverse();
  const sparkScores = sparkSessions.map((s) => Math.round(s.score_pct));
  const sparkPoints = buildSparkPoints(sparkScores);
  // Trend: compare last score vs first score across the visible window.
  // Skip if fewer than 3 points — single-session "trends" are noise.
  const trend: "up" | "down" | "flat" | null =
    sparkScores.length >= 3
      ? sparkScores[sparkScores.length - 1] - sparkScores[0] > 8
        ? "up"
        : sparkScores[sparkScores.length - 1] - sparkScores[0] < -8
        ? "down"
        : "flat"
      : null;

  const accuracyColor: TileColor =
    accuracy >= 75 ? "emerald" : accuracy >= 50 ? "amber" : "red";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <section
      aria-labelledby="topic-mastery-heading"
      className="relative bg-slate-900/95 pixel-border text-indigo-500/70 px-5 py-5 sm:px-6 sm:py-6"
    >
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[2]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[2]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[2]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[2]" />

      <div className="relative z-[1] space-y-6">
        {/* Activity tiles */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-indigo-400" />
            <h2
              id="topic-mastery-heading"
              className="font-pixel text-[10px] tracking-wider text-indigo-300"
            >
              YOUR JOURNEY
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatTile
              icon={<Swords className="w-3.5 h-3.5" />}
              label="QUESTIONS"
              value={questionsAttempted.toString()}
              color="indigo"
            />
            <StatTile
              icon={<Target className="w-3.5 h-3.5" />}
              label="ACCURACY"
              value={`${accuracy}%`}
              color={accuracyColor}
            />
            <StatTile
              icon={<Clock className="w-3.5 h-3.5" />}
              label="MINUTES"
              value={totalMinutes.toString()}
              color="purple"
            />
            <StatTile
              icon={<Zap className="w-3.5 h-3.5" />}
              label="SESSIONS"
              value={sessionCount.toString()}
              color="amber"
            />
          </div>
        </div>

        {/* Score sparkline */}
        {sparkScores.length >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-pixel text-[9px] tracking-wider text-slate-400">
                SCORE TRAJECTORY · LAST {sparkScores.length}
              </h3>
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-pixel text-[8px] tracking-wider px-2 py-0.5 pixel-border",
                    trend === "up" && "text-emerald-400 bg-emerald-500/10",
                    trend === "down" && "text-red-400 bg-red-500/10",
                    trend === "flat" && "text-slate-400 bg-slate-500/10"
                  )}
                >
                  {trend === "up" && <TrendingUp className="w-3 h-3" />}
                  {trend === "down" && <TrendingDown className="w-3 h-3" />}
                  {trend === "flat" && <Minus className="w-3 h-3" />}
                  {trend === "up" && "RISING"}
                  {trend === "down" && "DIPPING"}
                  {trend === "flat" && "STEADY"}
                </span>
              )}
            </div>
            <Sparkline
              points={sparkPoints}
              latestScore={sparkScores[sparkScores.length - 1]}
            />
          </div>
        )}

        {/* Failed questions heatmap */}
        {failedQuestions.length > 0 && (
          <div className="border-t border-slate-800/60 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="font-pixel text-[10px] tracking-wider text-amber-300">
                STUMBLES · QUESTIONS YOU&apos;VE MISSED 2+ TIMES
              </h3>
            </div>
            <ul className="space-y-2">
              {failedQuestions.map((q) => (
                <li key={q.questionId}>
                  <details className="group pixel-border bg-amber-500/[0.04]">
                    <summary className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer list-none select-none">
                      <span
                        dir="auto"
                        className="text-xs sm:text-sm text-slate-200 truncate flex-1 group-open:whitespace-normal group-open:truncate-none"
                      >
                        <MarkdownInline>{q.content}</MarkdownInline>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-pixel text-[9px] tracking-wider text-amber-400 tabular-nums">
                          {q.failures}/{q.attempts} MISS
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 transition-transform group-open:rotate-180" />
                      </span>
                    </summary>
                    <div className="px-3 pb-3 pt-1 text-xs text-slate-400 border-t border-amber-500/10">
                      <p dir="auto" className="text-slate-300 leading-relaxed">
                        <MarkdownInline>{q.content}</MarkdownInline>
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-[11px] text-slate-500 flex-1 min-w-0">
                          Last attempted{" "}
                          {new Date(q.lastAttemptAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          . Re-attempting via the Grimoire or a fresh quiz will
                          update your mastery.
                        </p>
                        {/* Regenerate — when the question itself is the
                            problem (ambiguous / hallucinated), replace it
                            with a fresh AI variant on the same concept.
                            Old row is soft-replaced server-side so this
                            stumble disappears from the list on refresh. */}
                        <StumbleRegenerateButton questionId={q.questionId} />
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Full quiz history */}
        <div className="border-t border-slate-800/60 pt-5">
          <h3 className="font-pixel text-[10px] tracking-wider text-slate-400 mb-3">
            QUEST LOG · {sessionCount} SESSION{sessionCount === 1 ? "" : "S"}
          </h3>
          <ul className="space-y-1.5">
            {sessions.slice(0, 10).map((s) => {
              const score = Math.round(s.score_pct);
              const scoreColor =
                score >= 75
                  ? "text-emerald-400"
                  : score >= 50
                  ? "text-amber-400"
                  : "text-red-400";
              const durationMin = Math.max(
                1,
                Math.round(
                  (new Date(s.completed_at).getTime() -
                    new Date(s.started_at).getTime()) /
                    1000 /
                    60
                )
              );
              return (
                <li key={s.id}>
                  <Link
                    href={`/dashboard/courses/${courseId}/topics/${topicId}/review/${s.id}`}
                    className="group flex items-center gap-3 bg-slate-800/30 hover:bg-slate-800/50 border border-transparent hover:border-indigo-500/20 px-3 py-2.5 transition-colors"
                  >
                    <span className="text-xs text-slate-500 group-hover:text-slate-400 tabular-nums w-14 flex-shrink-0">
                      {new Date(s.completed_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span
                      className={cn(
                        "font-pixel text-sm tabular-nums w-14 flex-shrink-0",
                        scoreColor
                      )}
                    >
                      {score}%
                    </span>
                    <span className="text-[11px] text-slate-500 flex-1 truncate">
                      {s.correct_count}/{s.question_count} correct · {durationMin}m
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 flex-shrink-0">
                      <Zap className="w-3 h-3" />+{s.xp_earned}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Sparkline — small inline SVG for the score trajectory. No charting lib.
// ───────────────────────────────────────────────────────────────────────────

function buildSparkPoints(scores: number[]): { x: number; y: number; score: number }[] {
  if (scores.length === 0) return [];
  const WIDTH = 100;
  const HEIGHT = 100;
  if (scores.length === 1) {
    return [{ x: WIDTH / 2, y: HEIGHT - scores[0], score: scores[0] }];
  }
  return scores.map((score, i) => ({
    x: (i / (scores.length - 1)) * WIDTH,
    y: HEIGHT - score,
    score,
  }));
}

function Sparkline({
  points,
  latestScore,
}: {
  points: { x: number; y: number; score: number }[];
  latestScore: number;
}) {
  if (points.length === 0) return null;
  // Build polyline path + area-under-curve fill.
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath =
    `M ${points[0].x},100 ` +
    points.map((p) => `L ${p.x},${p.y}`).join(" ") +
    ` L ${points[points.length - 1].x},100 Z`;

  // Line color from latest score — emerald/amber/red.
  const stroke =
    latestScore >= 75
      ? "#10b981"
      : latestScore >= 50
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div className="relative">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-16 sm:h-20"
        aria-hidden
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 50% reference line — visual baseline for "passing" */}
        <line
          x1="0"
          x2="100"
          y1="50"
          y2="50"
          stroke="#475569"
          strokeWidth="0.4"
          strokeDasharray="2 2"
        />
        <path d={areaPath} fill="url(#spark-fill)" />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="1.6"
            fill={stroke}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {/* Tiny min/max scale on the right edge */}
      <div className="absolute top-0 right-0 h-full flex flex-col justify-between text-[8px] font-pixel text-slate-600 pl-1.5">
        <span>100</span>
        <span>0</span>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// StatTile — same vocabulary as CourseStudyReport for consistency.
// ───────────────────────────────────────────────────────────────────────────

type TileColor = "indigo" | "emerald" | "amber" | "red" | "purple";

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: TileColor;
}) {
  const palette: Record<TileColor, { fg: string; bg: string }> = {
    indigo: { fg: "text-indigo-400", bg: "bg-indigo-500/10" },
    emerald: { fg: "text-emerald-400", bg: "bg-emerald-500/10" },
    amber: { fg: "text-amber-400", bg: "bg-amber-500/10" },
    red: { fg: "text-red-400", bg: "bg-red-500/10" },
    purple: { fg: "text-purple-400", bg: "bg-purple-500/10" },
  };
  const c = palette[color];
  return (
    <div className={cn("pixel-border px-3 py-2.5", c.bg)}>
      <div className={cn("flex items-center gap-1.5 mb-1", c.fg)}>
        {icon}
        <span className="font-pixel text-[8px] tracking-wider">{label}</span>
      </div>
      <div className={cn("font-pixel text-base tabular-nums", c.fg)}>
        {value}
      </div>
    </div>
  );
}
