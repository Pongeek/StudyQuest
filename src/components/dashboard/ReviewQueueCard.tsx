import Link from "next/link";
import { Brain, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DueTopic {
  topicTitle: string;
}

interface ReviewQueueCardProps {
  dueCount: number;
  dueTopics: DueTopic[];
  /** Estimated minutes for the review session */
  estMinutes?: number;
}

/**
 * Dashboard card for the spaced repetition review queue.
 * Renders above TodaysMission when there are due topics.
 * Switches to warning/orange tint when 10+ topics are overdue.
 */
export default function ReviewQueueCard({
  dueCount,
  dueTopics,
  estMinutes,
}: ReviewQueueCardProps) {
  if (dueCount === 0) return null;

  const isUrgent = dueCount >= 10;
  const shownTopics = dueTopics.slice(0, 3);
  const hiddenCount = dueCount - shownTopics.length;

  // Estimate: ~3 min per topic (2 questions each ≈ 1.5 min + buffer)
  const minutes = estMinutes ?? Math.max(3, Math.round(dueCount * 3));

  return (
    <section
      aria-labelledby="review-queue-heading"
      className="rounded-2xl px-5 py-5 sm:px-6 sm:py-6 relative overflow-hidden animate-slide-up rpg-card card-alive widget-elev"
      style={{
        animationDelay: "0.05s",
        ["--alive-rgb" as string]: isUrgent ? "249 115 22" : "34 211 238",
      }}
    >
      {/* Dot-matrix texture — alive-pass depth */}
      <span aria-hidden className="absolute inset-0 hud-hero-texture pointer-events-none rounded-2xl" />

      {/* Top accent line — semantic color signal, replaces the full border */}
      <div
        aria-hidden
        className={cn(
          "absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent to-transparent",
          isUrgent ? "via-orange-400/50" : "via-cyan-400/50"
        )}
      />

      {/* Pixel nail corners — ties the card to the dashboard widget family */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[1]", isUrgent ? "bg-orange-400/80" : "bg-cyan-400/80")} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[1]", isUrgent ? "bg-orange-400/80" : "bg-cyan-400/80")} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[1]", isUrgent ? "bg-orange-400/80" : "bg-cyan-400/80")} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[1]", isUrgent ? "bg-orange-400/80" : "bg-cyan-400/80")} />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {/* Icon tile — pixel-bordered, matches the widget-family vocabulary */}
        <div
          className={cn(
            "w-12 h-12 pixel-border flex items-center justify-center shrink-0",
            isUrgent
              ? "bg-orange-500/10 text-orange-400"
              : "bg-cyan-500/10 text-cyan-400"
          )}
          aria-hidden
        >
          {isUrgent ? (
            <AlertTriangle className="w-6 h-6 text-orange-400" />
          ) : (
            <Brain className="w-6 h-6 text-cyan-400" />
          )}
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-[11px] uppercase tracking-wider font-medium mb-1",
              isUrgent ? "text-orange-400/90" : "text-cyan-400/90"
            )}
          >
            Daily Review
          </div>

          <h2
            id="review-queue-heading"
            className="text-lg sm:text-xl font-bold text-white leading-tight tracking-tight"
          >
            {isUrgent ? (
              <>
                <span className="text-orange-400">{dueCount} topics piling up</span>
                {" "}— review now before you fall behind!
              </>
            ) : (
              <>
                <span className={cn(isUrgent ? "text-orange-400" : "text-cyan-400")}>
                  {dueCount} {dueCount === 1 ? "topic" : "topics"}
                </span>{" "}
                ready{" "}
                <span className="text-slate-400 font-normal text-base">
                  &middot; ~{minutes} min
                </span>
              </>
            )}
          </h2>

          {/* Topic chips */}
          {shownTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {shownTopics.map((t, i) => (
                <span
                  key={i}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border truncate max-w-[160px]",
                    isUrgent
                      ? "bg-orange-500/10 border-orange-500/20 text-orange-300"
                      : "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
                  )}
                >
                  {t.topicTitle}
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="text-xs text-slate-500">
                  +{hiddenCount} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* CTA — quiet when routine; solid orange only when the queue is
            actually piling up (urgency earns loudness). */}
        <Link href="/dashboard/review" className="shrink-0 w-full sm:w-auto block pixel-focus outline-none rounded-lg">
          <span
            className={cn(
              "w-full sm:w-auto px-5 py-2.5 rounded-lg flex items-center justify-center gap-2",
              "font-pixel text-[10px] tracking-wider transition-colors duration-150",
              isUrgent
                ? "bg-orange-500 text-slate-950 shadow-[0_4px_0_0_#7c2d12] hover:bg-orange-400"
                : "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-400/60"
            )}
          >
            <Brain className="w-4 h-4" aria-hidden />
            START REVIEW
            <ArrowRight className="w-4 h-4" aria-hidden />
          </span>
        </Link>
      </div>
    </section>
  );
}
