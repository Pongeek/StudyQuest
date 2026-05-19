import Link from "next/link";
import { Flame, Sparkles, Sword, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TodaysMissionProps {
  /** Current consecutive-day streak from users.current_streak */
  streak: number;
  /** Whether the user has completed any session today */
  studiedToday: boolean;
  /** Where the primary CTA should link. Falls back to /dashboard/courses if no recommendation exists. */
  nextQuestHref: string | null;
}

/**
 * Daily-quest hook shown on the dashboard above the Quest Board.
 *
 * Three states:
 *  - studied today           → null (don't waste vertical space)
 *  - streak ≥ 1, not today   → amber "streak at risk" rescue CTA with pulse-ring
 *  - no streak yet           → indigo "ignite a streak" CTA
 */
export default function TodaysMission({
  streak,
  studiedToday,
  nextQuestHref,
}: TodaysMissionProps) {
  if (studiedToday) return null;

  const hasStreak = streak >= 1;
  const href = nextQuestHref ?? "/dashboard/courses";

  return (
    <section
      aria-labelledby="todays-mission-heading"
      className={cn(
        "rounded-2xl px-5 py-5 sm:px-6 sm:py-6 relative overflow-hidden",
        "animate-slide-up",
        hasStreak ? "rpg-card-gold" : "rpg-card",
      )}
      style={{ animationDelay: "0.1s" }}
    >
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {/* Icon tile */}
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
            hasStreak
              ? "bg-amber-500/10 border-amber-500/25"
              : "bg-indigo-500/10 border-indigo-500/25",
          )}
          aria-hidden
        >
          {hasStreak ? (
            <Flame className="w-6 h-6 text-amber-400" />
          ) : (
            <Sparkles className="w-6 h-6 text-indigo-400" />
          )}
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-[11px] uppercase tracking-wider font-medium mb-1",
              hasStreak ? "text-amber-400/90" : "text-indigo-400/90",
            )}
          >
            Today&rsquo;s Mission
          </div>
          <h2
            id="todays-mission-heading"
            className="text-lg sm:text-xl font-bold text-white leading-tight tracking-tight"
          >
            {hasStreak ? (
              <>
                Keep the fire alive{" "}
                <span className="text-amber-400">
                  &middot; {streak}-day streak
                </span>
              </>
            ) : (
              <>Begin your first streak</>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            {hasStreak
              ? "Complete one quest today to keep your streak burning. It only takes a few minutes."
              : "Finish a single quest today to ignite your streak. Tomorrow it gets stronger."}
          </p>
        </div>

        {/* CTA */}
        <Link href={href} className="shrink-0 w-full sm:w-auto block">
          <Button
            size="lg"
            className={cn(
              "w-full sm:w-auto gap-2 font-medium",
              hasStreak
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                : "bg-indigo-500 hover:bg-indigo-400 text-white",
            )}
          >
            <Sword className="w-4 h-4" />
            {hasStreak ? "Continue the Quest" : "Begin Today's Quest"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
