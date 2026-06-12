"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gem, RotateCcw, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import LevelUpOverlay from "@/components/effects/LevelUpOverlay";
import AchievementUnlockOverlay from "@/components/effects/AchievementUnlockOverlay";
import { useSound } from "@/lib/useSound";
import type { DrillScope, RuneCompleteResponse } from "./RuneDrillEngine";

interface RuneSummaryProps {
  data: RuneCompleteResponse;
  totalCards: number;
  lapseCount: number;
  scope: DrillScope;
  onRestart?: () => void;
}

type Phase = "stats" | "level-up" | "achievements" | "done";

/**
 * End-of-drill summary. Celebration order mirrors ReviewSummary: stats →
 * level-up overlay → achievement overlay. Navigation buttons call
 * router.refresh() in their onClick (never earlier — house rule), so server
 * pages re-read due counts only when the player actually leaves.
 */
export default function RuneSummary({
  data,
  totalCards,
  lapseCount,
  scope,
  onRestart,
}: RuneSummaryProps) {
  const router = useRouter();
  const { play } = useSound();
  const [phase, setPhase] = useState<Phase>("stats");

  useEffect(() => {
    play("reviewComplete");
  }, [play]);

  useEffect(() => {
    if (phase !== "stats") return;
    const t = setTimeout(() => {
      if (data.leveledUp) setPhase("level-up");
      else if (data.newAchievements.length > 0) setPhase("achievements");
      else setPhase("done");
    }, 1100);
    return () => clearTimeout(t);
  }, [phase, data.leveledUp, data.newAchievements.length]);

  function advanceFromLevelUp() {
    setPhase(data.newAchievements.length > 0 ? "achievements" : "done");
  }

  const showRemaining = scope === "due" && data.remainingDue > 0 && onRestart;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <LevelUpOverlay
        show={phase === "level-up"}
        fromLevel={data.oldLevel}
        toLevel={data.newLevel}
        newRank={data.newRank}
        onClose={advanceFromLevelUp}
      />
      {phase === "achievements" && data.newAchievements.length > 0 && (
        <AchievementUnlockOverlay
          achievements={data.newAchievements}
          onAllDismissed={() => setPhase("done")}
        />
      )}

      <section className="rpg-card rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden animate-bounce-in">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
        <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-purple-400" />
        <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-purple-400" />
        <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-purple-400" />
        <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-purple-400" />

        <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-3">
          <Gem className="w-7 h-7 text-purple-400" />
        </div>
        <h1 className="font-pixel text-xs tracking-wider text-purple-300 mb-1">
          DRILL COMPLETE
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          Every rune answered — the schedule has been recast.
        </p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-3">
            <p className="text-xl font-extrabold text-white tabular-nums">{totalCards}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
              Runes
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-3">
            <p className="text-xl font-extrabold text-orange-300 tabular-nums">
              {lapseCount}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
              Relearned
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-3">
            <p className="text-xl font-extrabold text-amber-300 tabular-nums inline-flex items-center gap-1">
              <Zap className="w-4 h-4" />
              +{data.xpEarned}
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
              XP
            </p>
          </div>
        </div>

        {data.queueCleared && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 mb-5">
            <p className="font-pixel text-[9px] tracking-wider text-amber-300">
              <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1.5" />
              DAILY QUEUE CLEARED — BONUS BANKED
            </p>
          </div>
        )}

        {scope === "due" && data.remainingDue > 0 && (
          <p className="text-xs text-slate-500 mb-5">
            {data.remainingDue} rune{data.remainingDue === 1 ? "" : "s"} still
            waiting in the queue.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showRemaining && (
            <Button
              onClick={onRestart}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-semibold gap-2 min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              Drill the rest
            </Button>
          )}
          <Button
            variant={showRemaining ? "outline" : undefined}
            onClick={() => {
              // Refresh-on-nav (house rule): server pages re-read due counts
              // here, not when /complete returned.
              router.refresh();
              router.push("/dashboard");
            }}
            className={
              showRemaining
                ? "w-full sm:w-auto border-slate-700/50 text-slate-300 hover:bg-white/5 min-h-[44px]"
                : "w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-semibold min-h-[44px]"
            }
          >
            Return to Realm
          </Button>
        </div>
      </section>
    </div>
  );
}
