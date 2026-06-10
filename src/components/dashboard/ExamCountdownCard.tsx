"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Sparkles,
  Sword,
  Swords,
  BookOpen,
  Clock,
  Trophy,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyPlan } from "@/lib/study-plan";

interface ExamCountdownCardProps {
  /** All exam-set courses for this user. The card cycles through them —
   *  soonest first by default, "Show next →" walks to the next-soonest.
   *  Must contain at least one plan; the dashboard guards on this. */
  plans: StudyPlan[];
  /** When true, the card sits at half width alongside Next Best Action and
   *  drops the "Today's plan" action list to avoid duplication (NBA already
   *  surfaces the single best action). Used by the paired grid on the
   *  dashboard's top row. */
  compact?: boolean;
}

/**
 * Dashboard widget for exam countdowns.
 *
 * Renders ONE plan at a time, cycling via a "Show next →" link (same
 * vocabulary as NextBestActionCard). With one exam set, the cycle button
 * hides and the card behaves like a static countdown. With multiple
 * exams, the user can walk through them all from a single card slot
 * instead of stacking N cards down the page.
 *
 * Sections (top → bottom):
 *   - Header: course title + "X days until …" countdown chip
 *   - Headline + recommended pace
 *   - Today's plan: list of actions linked to start them (hidden in compact)
 *   - Cycle row: "Show next →" + "1/N" badge (only when plans.length > 1)
 */
export default function ExamCountdownCard({
  plans,
  compact = false,
}: ExamCountdownCardProps) {
  const [index, setIndex] = useState(0);

  if (plans.length === 0) return null;

  const safeIndex = Math.min(index, plans.length - 1);
  const plan = plans[safeIndex];
  const hasMore = plans.length > 1;
  const isLast = safeIndex >= plans.length - 1;
  // Tier B+ color schema. Outer card stays soft (info-dense surfaces don't
  // need a pixel-border competing with the data), but the countdown chip,
  // accent line, and pixel-nail corners carry urgency color so the card
  // visibly belongs to the same family as Today's Mission / Quest Board.
  const urgencyChip = urgencyChipClass(plan.urgency);
  const urgencyAccent = urgencyAccentClass(plan.urgency);
  const urgencyNail = urgencyNailClass(plan.urgency);

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
      style={{ ["--alive-rgb" as string]: urgencyAliveRgb(plan.urgency) }}
      className="rpg-card card-alive rounded-2xl p-5 sm:p-6 relative overflow-hidden animate-slide-up flex flex-col h-full"
    >
      {/* Dot-matrix texture — alive-pass depth */}
      <span aria-hidden className="absolute inset-0 hud-hero-texture pointer-events-none rounded-2xl" />

      {/* Top accent line — urgency-colored */}
      <div className={cn("absolute top-0 inset-x-0 h-0.5", urgencyAccent)} />

      {/* Pixel nail corners — urgency-colored, ties card to Tier A family */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5", urgencyNail)} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5", urgencyNail)} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5", urgencyNail)} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5", urgencyNail)} />

      {/* Header */}
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-[9px] tracking-wider text-slate-500 flex items-center gap-1.5">
            <CalendarDays className="w-3 h-3" />
            {(plan.examLabel || "Exam").toUpperCase()} · {examDateStr.toUpperCase()}
          </p>
          <h2
            id={`exam-${plan.courseId}-heading`}
            className="text-base sm:text-lg font-bold text-white tracking-tight mt-2 truncate"
          >
            {plan.courseTitle}
          </h2>
        </div>

        {/* Countdown chip — pixel-bordered scoreboard. text-color drives both
            the inner content color AND the pixel-border (via currentColor). */}
        <div
          className={cn(
            "shrink-0 inline-flex flex-col items-center justify-center px-3 py-2 min-w-[72px]",
            "pixel-border bg-slate-950/40",
            urgencyChip
          )}
        >
          {plan.urgency === "past" ? (
            <>
              <span className="font-pixel text-[8px] tracking-wider opacity-70">WAS</span>
              <span className="text-lg font-bold tabular-nums leading-none">
                {Math.abs(plan.daysUntilExam)}d
              </span>
              <span className="font-pixel text-[8px] tracking-wider opacity-70">AGO</span>
            </>
          ) : plan.urgency === "exam-day" ? (
            <>
              <span className="font-pixel text-[9px] tracking-wider">EXAM</span>
              <span className="font-pixel text-[11px] tracking-wider mt-1">TODAY</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-extrabold tabular-nums leading-none">
                {plan.daysUntilExam}
              </span>
              <span className="font-pixel text-[8px] tracking-wider opacity-80 mt-1">
                {plan.daysUntilExam === 1 ? "DAY LEFT" : "DAYS LEFT"}
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

      {/* Today's plan — hidden in compact mode (NBA in the paired grid
          already shows the single best action; rendering the full plan
          list here would duplicate it). */}
      {!compact && plan.urgency !== "past" && plan.actions.length > 0 && (
        <>
          <div className="font-pixel text-[9px] tracking-wider text-amber-400/80 mb-3 flex items-center gap-2">
            <Sword className="w-3 h-3" />
            TODAY&apos;S PLAN
            <span className="text-slate-700">·</span>
            <span className="text-slate-500 flex items-center gap-1 tabular-nums">
              <Clock className="w-3 h-3" />
              ~{plan.estimatedTotalMinutes}M
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

      {/* Topics done case — also hidden in compact mode (NBA already
          handles the "what's next" prompt when there's nothing left). */}
      {!compact && plan.urgency !== "past" && plan.actions.length === 0 && (
        <div className="rounded-lg px-4 py-3 border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-300 flex items-center gap-2">
          <Trophy className="w-4 h-4 shrink-0" />
          <span>
            Nothing left to do today — all topics mastered. Take a review session
            to stay sharp, or just rest. You&apos;ve earned it.
          </span>
        </div>
      )}

      {/* Footer row. In compact mode we drop the full action list (NBA owns
          the single best action), but we still surface a one-line hook to
          THIS course so the user isn't left guessing what's behind the
          header — either a "View today's plan →" link with the action count
          or a tiny "all clear" pill. The cycle button sits on the right. */}
      {(compact || hasMore) && (
        <div className="mt-auto pt-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            {compact && plan.urgency !== "past" && plan.actions.length > 0 && (
              <Link
                href={`/dashboard/courses/${plan.courseId}`}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-indigo-200 transition-colors"
              >
                <Sword className="w-3 h-3 text-amber-400/80" />
                <span>
                  {plan.actions.length} action
                  {plan.actions.length === 1 ? "" : "s"} today
                </span>
                <span className="text-slate-700">·</span>
                <span className="tabular-nums">~{plan.estimatedTotalMinutes}m</span>
                <ChevronRight className="w-3 h-3" aria-hidden />
              </Link>
            )}
            {compact && plan.urgency !== "past" && plan.actions.length === 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
                <Trophy className="w-3 h-3" />
                <span>All topics mastered</span>
              </span>
            )}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % plans.length)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={
                isLast
                  ? `Cycle back to first exam (${plans.length} total)`
                  : `Show next exam (${safeIndex + 1} of ${plans.length})`
              }
            >
              {isLast ? "Back to first" : "Show next"}
              <ChevronRight className="w-3 h-3" aria-hidden />
              <span className="font-pixel text-[8px] tracking-wider text-slate-600 ml-1">
                {safeIndex + 1}/{plans.length}
              </span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function urgencyChipClass(urgency: StudyPlan["urgency"]): string {
  // Returns ONLY a text-color (+ optional animate) — the pixel-border
  // utility picks the border tone up via currentColor.
  switch (urgency) {
    case "exam-day":
      return "text-red-300 animate-pulse";
    case "final-push":
      return "text-red-300";
    case "crunch":
      return "text-orange-300";
    case "steady":
      return "text-amber-300";
    case "calm":
      return "text-emerald-300";
    case "past":
      return "text-slate-500";
  }
}

function urgencyNailClass(urgency: StudyPlan["urgency"]): string {
  switch (urgency) {
    case "exam-day":
    case "final-push":
      return "bg-red-400";
    case "crunch":
      return "bg-orange-400";
    case "steady":
      return "bg-amber-400";
    case "calm":
      return "bg-emerald-400";
    case "past":
      return "bg-slate-600";
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

function urgencyAliveRgb(urgency: StudyPlan["urgency"]): string {
  // "R G B" triplet for the card-alive fill — tracks the same urgency
  // semantic as the chip / nails / accent helpers above.
  switch (urgency) {
    case "exam-day":
    case "final-push":
      return "239 68 68";
    case "crunch":
      return "249 115 22";
    case "steady":
      return "245 158 11";
    case "calm":
      return "16 185 129";
    case "past":
      return "100 116 139";
  }
}

function ActionIcon({ kind }: { kind: StudyPlan["actions"][number]["kind"] }) {
  // Pixel-bordered icon tile — currentColor drives both icon + border tone.
  // Subtle Tier B+ signature on each row without competing with the countdown chip.
  const cls = "w-4 h-4 shrink-0";
  switch (kind) {
    case "study-topic":
      return (
        <div className="w-7 h-7 pixel-border bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
          <BookOpen className={cls} />
        </div>
      );
    case "review":
      return (
        <div className="w-7 h-7 pixel-border bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
          <Sparkles className={cls} />
        </div>
      );
    case "boss-fight":
      return (
        <div className="w-7 h-7 pixel-border bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
          <Swords className={cls} />
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
