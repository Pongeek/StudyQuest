import { createServiceClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Target,
  BookOpen,
  CalendarClock,
  TrendingDown,
} from "lucide-react";
import { MASTERY_LABELS } from "@/lib/xp";

interface CourseStudyReportProps {
  /** Topic IDs in this course (across all episodes). Used to filter quiz +
   *  review activity to *this* course only. */
  topicIds: string[];
  /** Episode IDs in this course. Used to filter boss-fight activity. */
  episodeIds: string[];
  /** DB user id (resolved from clerk_id by the parent page). */
  dbUserId: string;
  /** Course exam date — drives the "days to exam" tile. */
  examDate: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Course-level weekly study report.
 *
 * Server component that fetches three session tables (quiz / boss / review)
 * scoped to this course, aggregates last-7-day totals, and renders a
 * Tier B+ pixel-bordered widget at the top of the course page.
 *
 * Renders nothing if the user has no activity *and* no exam date set —
 * empty state would just be noise on a brand-new course page.
 */
export default async function CourseStudyReport({
  topicIds,
  episodeIds,
  dbUserId,
  examDate,
}: CourseStudyReportProps) {
  if (topicIds.length === 0) return null;

  const supabase = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  // Parallel queries — quiz/boss/review/mastery. Each independent so
  // Promise.all is fine. `not("completed_at", "is", null)` makes sure
  // we count only finished sessions.
  const [quizRes, bossRes, reviewRes, masteryRes] = await Promise.all([
    supabase
      .from("quiz_sessions")
      .select("topic_id, question_count, correct_count")
      .eq("user_id", dbUserId)
      .in("topic_id", topicIds)
      .gte("completed_at", sevenDaysAgo)
      .not("completed_at", "is", null),
    episodeIds.length > 0
      ? supabase
          .from("boss_fight_sessions")
          .select("episode_id, question_count, correct_count")
          .eq("user_id", dbUserId)
          .in("episode_id", episodeIds)
          .gte("completed_at", sevenDaysAgo)
          .not("completed_at", "is", null)
      : Promise.resolve({ data: [] as Array<{ episode_id: string; question_count: number; correct_count: number }> }),
    // Review sessions store topic_ids as JSONB, so we can't `.in()`. Fetch
    // all this user's recent review sessions, filter to ours in JS.
    supabase
      .from("review_sessions")
      .select("topic_ids, question_count, correct_count")
      .eq("user_id", dbUserId)
      .gte("completed_at", sevenDaysAgo)
      .not("completed_at", "is", null),
    supabase
      .from("user_topic_mastery")
      .select("topic_id, mastery_level, topics(title)")
      .eq("user_id", dbUserId)
      .in("topic_id", topicIds),
  ]);

  let questionsAttempted = 0;
  let questionsCorrect = 0;
  const topicsPracticed = new Set<string>();

  for (const s of quizRes.data ?? []) {
    questionsAttempted += s.question_count || 0;
    questionsCorrect += s.correct_count || 0;
    if (s.topic_id) topicsPracticed.add(s.topic_id);
  }
  for (const s of bossRes.data ?? []) {
    questionsAttempted += s.question_count || 0;
    questionsCorrect += s.correct_count || 0;
    // Boss fights don't map to a single topic — they cover the whole
    // episode. We don't add to topicsPracticed for that reason; it would
    // overstate by N topics per single boss fight.
  }
  const topicIdSet = new Set(topicIds);
  for (const s of reviewRes.data ?? []) {
    const sessionTopicIds = Array.isArray(s.topic_ids) ? (s.topic_ids as string[]) : [];
    // Only count this review session if at least one of its topics belongs
    // to *this* course. Reviews are global across the user's courses.
    const overlaps = sessionTopicIds.some((id) => topicIdSet.has(id));
    if (!overlaps) continue;
    questionsAttempted += s.question_count || 0;
    questionsCorrect += s.correct_count || 0;
    for (const id of sessionTopicIds) {
      if (topicIdSet.has(id)) topicsPracticed.add(id);
    }
  }

  const accuracy =
    questionsAttempted > 0
      ? Math.round((questionsCorrect / questionsAttempted) * 100)
      : 0;

  // Weakest topics — bottom 3 by mastery_level, but only show topics
  // mastered < Adept (3). If all are Adept+, we hide the section.
  type MasteryRow = {
    topic_id: string;
    mastery_level: number | null;
    topics: { title: string } | { title: string }[] | null;
  };
  const masteryList = ((masteryRes.data ?? []) as MasteryRow[])
    .map((m) => {
      const t = Array.isArray(m.topics) ? m.topics[0] : m.topics;
      return {
        topicId: m.topic_id,
        masteryLevel: m.mastery_level ?? 0,
        title: t?.title ?? "Topic",
      };
    });
  const weakest = [...masteryList]
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
    .slice(0, 3)
    .filter((t) => t.masteryLevel < 3);

  // Days to exam. Negative = past, so we hide the tile in that case.
  let daysToExam: number | null = null;
  if (examDate) {
    const examMs = new Date(examDate + "T00:00:00").getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((examMs - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) daysToExam = diffDays;
  }

  // Nothing to say yet — brand-new course with no exam date.
  if (questionsAttempted === 0 && daysToExam === null) return null;

  // Border tone shifts amber if the exam is within 14 days — pulls the
  // user's eye to the urgency cue without yelling at them.
  const isCrunch = daysToExam !== null && daysToExam <= 14;
  const borderTone = isCrunch ? "text-amber-500/80" : "text-indigo-500/70";
  const nailColor = isCrunch ? "bg-amber-400" : "bg-indigo-400";
  const headerColor = isCrunch ? "text-amber-300" : "text-indigo-300";

  const accuracyColor: TileColor =
    accuracy >= 75 ? "emerald" : accuracy >= 50 ? "amber" : "red";

  const examColor: TileColor | null =
    daysToExam === null
      ? null
      : daysToExam <= 3
      ? "red"
      : daysToExam <= 14
      ? "amber"
      : "emerald";

  return (
    <section
      aria-labelledby="study-report-heading"
      className={cn(
        "relative bg-slate-900/95 pixel-border px-5 py-5 sm:px-6 sm:py-6",
        borderTone
      )}
    >
      {/* Status-colored pixel nails — match the rest of the family. */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[2]", nailColor)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[2]", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[2]", nailColor)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[2]", nailColor)} />

      <div className="relative z-[1]">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className={cn("w-4 h-4", headerColor)} />
          <h2
            id="study-report-heading"
            className={cn("font-pixel text-[10px] tracking-wider", headerColor)}
          >
            STUDY REPORT — LAST 7 DAYS
          </h2>
        </div>

        {questionsAttempted === 0 ? (
          <p className="text-sm text-slate-400">
            Take any quiz this week to start your weekly report.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            <StatTile
              icon={<BookOpen className="w-3.5 h-3.5" />}
              label="ATTEMPTED"
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
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label="TOPICS"
              value={topicsPracticed.size.toString()}
              color="purple"
            />
            {examColor && daysToExam !== null && (
              <StatTile
                icon={<CalendarClock className="w-3.5 h-3.5" />}
                label="DAYS TO EXAM"
                value={daysToExam.toString()}
                color={examColor}
              />
            )}
          </div>
        )}

        {weakest.length > 0 && (
          <div className="border-t border-slate-800/60 pt-3 mt-1">
            <div className="flex items-center gap-2 mb-2.5">
              <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
              <h3 className="font-pixel text-[9px] tracking-wider text-amber-300">
                NEEDS ATTENTION
              </h3>
            </div>
            <ul className="space-y-1.5">
              {weakest.map((t) => (
                <li
                  key={t.topicId}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-slate-300 truncate flex-1">{t.title}</span>
                  <span
                    className={cn(
                      "font-pixel text-[9px] tracking-wider px-2 py-0.5 pixel-border flex-shrink-0",
                      t.masteryLevel <= 1
                        ? "text-slate-400 bg-slate-500/10"
                        : "text-emerald-400 bg-emerald-500/10"
                    )}
                  >
                    {MASTERY_LABELS[t.masteryLevel] ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

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
