import Link from "next/link";
import { CalendarDays, Sparkles, Sword, Swords, BookOpen, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyPlan } from "@/lib/study-plan";

interface ExamCountdownCardProps {
  plan: StudyPlan;
}

/**
 * Dashboard widget shown for each course that has an exam_date set.
 *
 * Sections (top → bottom):
 *   - Header: course title + "X days until …" countdown
 *   - Headline + recommended pace
 *   - Today's plan: list of actions linked to start them
 */
export default function ExamCountdownCard({ plan }: ExamCountdownCardProps) {
  // Tier-based color schema. The card itself stays neutral; only the
  // countdown chip and accent line carry urgency color so the dashboard
  // doesn't feel chaotic when multiple courses are listed.
  const urgencyChip = urgencyChipClass(plan.urgency);
  const urgencyAccent = urgencyAccentClass(plan.urgency);

  // Pinned to en-US so the server-rendered and client-rendered string
  // agree (avoids the React hydration mismatch you get with the
  // runtime-default locale).
  const examDateStr = plan.examDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section
      aria-labelledby={`exam-${plan.courseId}-heading`}
      className="rpg-card rounded-2xl p-5 sm:p-6 relative overflow-hidden animate-slide-up"
    >
      {/* Top accent line — urgency-colored */}
      <div className={cn("absolute top-0 inset-x-0 h-0.5", urgencyAccent)} />

      {/* Header */}
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1.5">
            <CalendarDays className="w-3 h-3" />
            {plan.examLabel || "Exam"} · {examDateStr}
          </p>
          <h2
            id={`exam-${plan.courseId}-heading`}
            className="text-base sm:text-lg font-bold text-white tracking-tight mt-1 truncate"
          >
            {plan.courseTitle}
          </h2>
        </div>

        {/* Countdown chip */}
        <div
          className={cn(
            "shrink-0 inline-flex flex-col items-center justify-center rounded-xl border px-3 py-1.5 min-w-[64px]",
            urgencyChip
          )}
        >
          {plan.urgency === "past" ? (
            <>
              <span className="text-xs font-medium opacity-70">Was</span>
              <span className="text-lg font-bold tabular-nums leading-none">
                {Math.abs(plan.daysUntilExam)}d
              </span>
              <span className="text-[10px] opacity-70">ago</span>
            </>
          ) : plan.urgency === "exam-day" ? (
            <>
              <span className="text-xs font-bold">EXAM</span>
              <span className="text-base font-bold">TODAY</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-extrabold tabular-nums leading-none">
                {plan.daysUntilExam}
              </span>
              <span className="text-[10px] uppercase tracking-wider opacity-80 mt-0.5">
                day{plan.daysUntilExam === 1 ? "" : "s"} left
              </span>
            </>
          )}
        </div>
      </header>

      {/* Headline + pace info */}
      <p className="text-sm text-slate-300 leading-relaxed mb-4">{plan.headline}</p>

      {plan.urgency !== "past" && plan.topicsStillToMaster > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 flex-wrap">
          <Sparkles className="w-3 h-3 text-amber-400/70 shrink-0" />
          <span>
            <span className="text-slate-300 font-semibold tabular-nums">
              {plan.topicsStillToMaster}
            </span>{" "}
            topics still to master
          </span>
          {plan.topicsPerDayRecommended > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <span>
                target pace:{" "}
                <span className="text-slate-300 font-semibold tabular-nums">
                  {plan.topicsPerDayRecommended}/day
                </span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Today's plan */}
      {plan.urgency !== "past" && plan.actions.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-amber-400/75 mb-2.5 flex items-center gap-2">
            <Sword className="w-3 h-3" />
            Today&apos;s plan
            <span className="text-slate-700">·</span>
            <span className="text-slate-500 flex items-center gap-1 tabular-nums font-medium tracking-normal normal-case">
              <Clock className="w-3 h-3" />
              ~{plan.estimatedTotalMinutes} min
            </span>
          </div>
          <ul className="space-y-1.5">
            {plan.actions.map((action, i) => (
              <li key={i}>
                <Link
                  href={action.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-colors group"
                >
                  <ActionIcon kind={action.kind} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate group-hover:text-indigo-200 transition-colors">
                      {actionLabel(action)}
                    </p>
                    {action.episodeTitle && action.kind !== "boss-fight" && (
                      <p className="text-[11px] text-slate-500 truncate">
                        {action.episodeTitle}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                    {action.estimatedMinutes}m
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Topics done case */}
      {plan.urgency !== "past" && plan.actions.length === 0 && (
        <div className="rounded-lg px-4 py-3 border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-300 flex items-center gap-2">
          <Trophy className="w-4 h-4 shrink-0" />
          <span>
            Nothing left to do today — all topics mastered. Take a review session
            to stay sharp, or just rest. You&apos;ve earned it.
          </span>
        </div>
      )}
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function urgencyChipClass(urgency: StudyPlan["urgency"]): string {
  switch (urgency) {
    case "exam-day":
      return "border-red-500/40 bg-red-500/15 text-red-300 animate-pulse";
    case "final-push":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "crunch":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "steady":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "calm":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "past":
      return "border-slate-700/40 bg-slate-800/40 text-slate-500";
  }
}

function urgencyAccentClass(urgency: StudyPlan["urgency"]): string {
  switch (urgency) {
    case "exam-day":
    case "final-push":
      return "bg-gradient-to-r from-transparent via-red-400/50 to-transparent";
    case "crunch":
      return "bg-gradient-to-r from-transparent via-orange-400/50 to-transparent";
    case "steady":
      return "bg-gradient-to-r from-transparent via-amber-400/50 to-transparent";
    case "calm":
      return "bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent";
    case "past":
      return "bg-gradient-to-r from-transparent via-slate-600/30 to-transparent";
  }
}

function ActionIcon({ kind }: { kind: StudyPlan["actions"][number]["kind"] }) {
  const cls = "w-4 h-4 shrink-0";
  switch (kind) {
    case "study-topic":
      return (
        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
          <BookOpen className={cn(cls, "text-indigo-400")} />
        </div>
      );
    case "review":
      return (
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
          <Sparkles className={cn(cls, "text-emerald-400")} />
        </div>
      );
    case "boss-fight":
      return (
        <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center">
          <Swords className={cn(cls, "text-red-400")} />
        </div>
      );
  }
}

function actionLabel(action: StudyPlan["actions"][number]): string {
  switch (action.kind) {
    case "study-topic":
      return `Study: ${action.topicTitle || "topic"}`;
    case "review":
      return "Spaced repetition review";
    case "boss-fight":
      return `Boss fight: ${action.episodeTitle || "episode"}`;
  }
}
