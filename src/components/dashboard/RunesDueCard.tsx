import Link from "next/link";
import { Gem, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DueRuneTopic {
  topicTitle: string;
}

interface RunesDueCardProps {
  dueCount: number;
  /** Distinct topic titles among the due cards (chips, up to 3 shown). */
  dueTopics: DueRuneTopic[];
  /** Estimated minutes for the drill (~10s per card). */
  estMinutes?: number;
}

/**
 * Dashboard card for the per-card rune queue — ReviewQueueCard's purple
 * sibling. Review = deep graded checks (cyan); Runes = fast self-graded
 * recall reps (purple/arcane). Renders right below ReviewQueueCard and
 * disappears at zero due. Urgent (orange) when the pile hits 20+.
 */
export default function RunesDueCard({
  dueCount,
  dueTopics,
  estMinutes,
}: RunesDueCardProps) {
  if (dueCount === 0) return null;

  const isUrgent = dueCount >= 20;
  const shownTopics = dueTopics.slice(0, 3);

  // ~10 seconds per card — flips are fast; that's the whole point.
  const minutes = estMinutes ?? Math.max(1, Math.round((dueCount * 10) / 60));

  return (
    <section
      aria-labelledby="runes-due-heading"
      className="rounded-2xl px-5 py-5 sm:px-6 sm:py-6 relative overflow-hidden animate-slide-up rpg-card card-alive widget-elev"
      style={{
        animationDelay: "0.07s",
        ["--alive-rgb" as string]: isUrgent ? "249 115 22" : "168 85 247",
      }}
    >
      {/* Dot-matrix texture — alive-pass depth */}
      <span aria-hidden className="absolute inset-0 hud-hero-texture pointer-events-none rounded-2xl" />

      {/* Top accent line */}
      <div
        aria-hidden
        className={cn(
          "absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent to-transparent",
          isUrgent ? "via-orange-400/50" : "via-purple-400/50"
        )}
      />

      {/* Pixel nail corners */}
      <span aria-hidden className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[1]", isUrgent ? "bg-orange-400/80" : "bg-purple-400/80")} />
      <span aria-hidden className={cn("absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[1]", isUrgent ? "bg-orange-400/80" : "bg-purple-400/80")} />
      <span aria-hidden className={cn("absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[1]", isUrgent ? "bg-orange-400/80" : "bg-purple-400/80")} />
      <span aria-hidden className={cn("absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[1]", isUrgent ? "bg-orange-400/80" : "bg-purple-400/80")} />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {/* Icon tile */}
        <div
          className={cn(
            "w-12 h-12 pixel-border flex items-center justify-center shrink-0",
            isUrgent
              ? "bg-orange-500/10 text-orange-400"
              : "bg-purple-500/10 text-purple-400"
          )}
          aria-hidden
        >
          {isUrgent ? (
            <AlertTriangle className="w-6 h-6 text-orange-400" />
          ) : (
            <Gem className="w-6 h-6 text-purple-400" />
          )}
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-[11px] uppercase tracking-wider font-medium mb-1",
              isUrgent ? "text-orange-400/90" : "text-purple-400/90"
            )}
          >
            Rune Deck
          </div>

          <h2
            id="runes-due-heading"
            className="text-lg sm:text-xl font-bold text-white leading-tight tracking-tight"
          >
            {isUrgent ? (
              <>
                <span className="text-orange-400">{dueCount} runes piling up</span>
                {" "}— a few minutes clears them all.
              </>
            ) : (
              <>
                <span className="text-purple-400">
                  {dueCount} {dueCount === 1 ? "rune" : "runes"}
                </span>{" "}
                due{" "}
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
                      : "bg-purple-500/10 border-purple-500/20 text-purple-300"
                  )}
                >
                  {t.topicTitle}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <Link href="/dashboard/runes" className="shrink-0 w-full sm:w-auto block pixel-focus outline-none rounded-lg">
          <span
            className={cn(
              "w-full sm:w-auto px-5 py-2.5 rounded-lg flex items-center justify-center gap-2",
              "font-pixel text-[10px] tracking-wider transition-colors duration-150",
              isUrgent
                ? "bg-orange-500 text-slate-950 shadow-[0_4px_0_0_#7c2d12] hover:bg-orange-400"
                : "border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/60"
            )}
          >
            <Gem className="w-4 h-4" aria-hidden />
            DRILL RUNES
            <ArrowRight className="w-4 h-4" aria-hidden />
          </span>
        </Link>
      </div>
    </section>
  );
}
