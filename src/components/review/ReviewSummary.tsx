"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Confetti from "@/components/effects/Confetti";
import LevelUpOverlay from "@/components/effects/LevelUpOverlay";
import AchievementUnlockOverlay, {
  type UnlockedAchievement,
} from "@/components/effects/AchievementUnlockOverlay";
import AnimatedCounter from "@/components/effects/AnimatedCounter";
import { cn } from "@/lib/utils";
import { useSound } from "@/lib/useSound";

interface TopicResult {
  topicId: string;
  topicTitle: string;
  scorePct: number;
  oldInterval: number;
  newInterval: number;
  nextReviewAt: string;
  passed: boolean;
  /** Set when the topic's review score bumped it to a new mastery tier.
   *  Surfaced inline as an ⭐ "Evolved!" badge on the result card. */
  evolved?: { fromLevel: number; toLevel: number } | null;
}

const REVIEW_TIER_NAMES: Record<number, string> = {
  1: "Novice",
  2: "Apprentice",
  3: "Adept",
  4: "Expert",
  5: "Master",
};

const REVIEW_TIER_BADGE: Record<number, string> = {
  1: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  2: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  3: "border-blue-400/30 bg-blue-500/10 text-blue-300",
  4: "border-purple-400/30 bg-purple-500/10 text-purple-300",
  5: "border-amber-400/40 bg-amber-500/15 text-amber-300",
};

interface ReviewSummaryProps {
  xpEarned: number;
  correctCount: number;
  totalCount: number;
  perTopicResults: TopicResult[];
  newAchievements: UnlockedAchievement[];
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  newRank?: string;
}

function formatInterval(days: number): string {
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} week${weeks !== 1 ? "s" : ""}`;
}

type SummaryPhase = "summary" | "level-up" | "achievements" | "done";

export default function ReviewSummary({
  xpEarned,
  correctCount,
  totalCount,
  perTopicResults,
  newAchievements,
  leveledUp,
  oldLevel,
  newLevel,
  newRank,
}: ReviewSummaryProps) {
  const router = useRouter();
  const allPassed = perTopicResults.every((r) => r.passed);
  const [phase, setPhase] = useState<SummaryPhase>("summary");
  const { play: playSfx } = useSound();

  // Count how many topics actually evolved during this review — used to
  // schedule a small follow-up sound and as a flag for the announcement bar.
  const evolvedTopicsCount = perTopicResults.filter((r) => r.evolved).length;
  const evolvedMaxTier = perTopicResults.reduce(
    (max, r) => (r.evolved && r.evolved.toLevel > max ? r.evolved.toLevel : max),
    0
  );

  // Play the "training complete" tone once when the summary first renders,
  // then a softer celebration ping if any topic evolved (chained behind the
  // first sound so they don't muddy each other).
  useEffect(() => {
    playSfx("reviewComplete");
    if (evolvedTopicsCount > 0) {
      const t = setTimeout(() => {
        // Tier-5 evolutions use the louder achievement cue.
        if (evolvedMaxTier >= 5) {
          playSfx("achievement");
        } else {
          playSfx("levelUp");
        }
      }, 650);
      return () => clearTimeout(t);
    }
  }, [playSfx, evolvedTopicsCount, evolvedMaxTier]);

  useEffect(() => {
    // Advance through phases after summary is shown
    if (phase === "summary") {
      if (leveledUp) {
        const t = setTimeout(() => setPhase("level-up"), 1200);
        return () => clearTimeout(t);
      } else if (newAchievements.length > 0) {
        const t = setTimeout(() => setPhase("achievements"), 1200);
        return () => clearTimeout(t);
      }
    }
  }, [phase, leveledUp, newAchievements.length]);

  const handleLevelUpClose = () => {
    if (newAchievements.length > 0) {
      setPhase("achievements");
    } else {
      setPhase("done");
    }
  };

  const handleAchievementsDismissed = () => {
    setPhase("done");
  };

  return (
    <>
      {allPassed && <Confetti trigger={1} count={100} duration={3500} />}

      {leveledUp && (
        <LevelUpOverlay
          show={phase === "level-up"}
          fromLevel={oldLevel}
          toLevel={newLevel}
          newRank={newRank}
          onClose={handleLevelUpClose}
        />
      )}

      {phase === "achievements" && newAchievements.length > 0 && (
        <AchievementUnlockOverlay
          achievements={newAchievements}
          onAllDismissed={handleAchievementsDismissed}
        />
      )}

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3 pt-4"
        >
          <p className="font-pixel text-cyan-400 text-[11px] uppercase tracking-widest">
            Review Complete
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Session done!
          </h1>
          <p className="text-slate-400 text-sm">
            {correctCount} of {totalCount} correct &middot; {allPassed ? "All topics pushed forward" : "Some topics reset for extra practice"}
          </p>
        </motion.div>

        {/* XP badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: "spring", damping: 14 }}
          className="rpg-card rounded-2xl p-6 text-center border-cyan-500/20 bg-cyan-500/5"
        >
          <div className="text-[11px] uppercase tracking-wider text-cyan-400/80 font-medium mb-1">
            XP Earned
          </div>
          <AnimatedCounter
            value={xpEarned}
            duration={1.2}
            className="text-5xl font-black text-white tracking-tight"
          />
          <div className="text-slate-400 text-sm mt-1">+{xpEarned} XP</div>
        </motion.div>

        {/* Per-topic results */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-1">
            Review Results
          </h2>
          <div className="space-y-2">
            <AnimatePresence>
              {perTopicResults.map((result, i) => {
                const improved = result.newInterval > result.oldInterval;
                const unchanged = result.newInterval === result.oldInterval;

                return (
                  <motion.div
                    key={result.topicId}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.08, duration: 0.35 }}
                    className={cn(
                      "rpg-card rounded-xl px-4 py-3.5 flex items-center gap-4 relative overflow-hidden",
                      result.passed
                        ? "border-green-500/15"
                        : "border-red-500/15",
                      // When a topic evolved, give the whole card a warm amber
                      // ambient glow that fades in after the row mounts.
                      result.evolved &&
                        "!border-amber-400/40 shadow-[0_0_24px_-8px_rgba(245,158,11,0.40)]"
                    )}
                  >
                    {/* Pass/fail indicator */}
                    <div
                      className={cn(
                        "w-1 self-stretch rounded-full flex-shrink-0",
                        result.evolved
                          ? "bg-amber-400/70"
                          : result.passed
                          ? "bg-green-500/50"
                          : "bg-red-500/50"
                      )}
                    />

                    {/* Topic info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">
                          {result.topicTitle}
                        </p>
                        {result.evolved && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              delay: 0.6 + i * 0.08,
                              type: "spring",
                              damping: 14,
                              stiffness: 200,
                            }}
                            className={cn(
                              "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                              REVIEW_TIER_BADGE[result.evolved.toLevel] ?? REVIEW_TIER_BADGE[1]
                            )}
                          >
                            <span aria-hidden="true">⭐</span>
                            <span>
                              Evolved &middot;{" "}
                              {REVIEW_TIER_NAMES[result.evolved.toLevel] ?? `Tier ${result.evolved.toLevel}`}
                            </span>
                          </motion.span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Score: {result.scorePct}%
                        {result.evolved && (
                          <span className="text-amber-400/80 ml-1.5">
                            &middot; Mastery {result.evolved.fromLevel} &rarr; {result.evolved.toLevel}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Interval delta */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {result.oldInterval}d
                      </span>
                      {improved ? (
                        <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
                      ) : unchanged ? (
                        <ArrowRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-bold tabular-nums",
                          improved ? "text-green-400" : unchanged ? "text-slate-400" : "text-red-400"
                        )}
                      >
                        {result.newInterval}d
                      </span>
                    </div>

                    {/* Next review */}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-slate-600 flex-shrink-0">
                      <Calendar className="w-3 h-3" />
                      {formatInterval(result.newInterval)}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Calendar peek */}
        {perTopicResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + perTopicResults.length * 0.08, duration: 0.35 }}
            className="rpg-card rounded-xl px-4 py-3.5"
          >
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">
              Next reviews scheduled
            </p>
            <div className="space-y-1">
              {perTopicResults.map((r) => (
                <div key={r.topicId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate">{r.topicTitle}</span>
                  <span className="text-slate-500 flex-shrink-0 ml-4">
                    {formatInterval(r.newInterval)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.35 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Button
            onClick={() => {
              // Refresh the route segment so the dashboard layout's cached
              // total_xp / streak / queue count picks up our new state.
              router.refresh();
              router.push("/dashboard");
            }}
            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              router.refresh();
              router.push("/dashboard/review");
            }}
            className="flex-1 border-slate-700/50 text-slate-300 hover:bg-white/5 gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            Review Again
          </Button>
        </motion.div>
      </div>
    </>
  );
}
