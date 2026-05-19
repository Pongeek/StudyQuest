"use client";

import { Flame, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakCounterProps {
  streak: number;
  compact?: boolean;
}

export default function StreakCounter({ streak, compact = false }: StreakCounterProps) {
  const isHot = streak >= 7;
  const isBlazing = streak >= 30;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 border transition-all duration-150",
          isHot
            ? "bg-white/[0.04] border-white/[0.07]"
            : "bg-white/[0.04] border-white/[0.07]"
        )}
      >
        <Flame className={cn(
          "w-3 h-3",
          isBlazing ? "text-orange-300" : isHot ? "text-orange-400" : "text-slate-500"
        )} />
        <span className={cn(
          "text-xs font-bold tabular-nums",
          isBlazing ? "text-orange-300" : isHot ? "text-orange-400" : "text-slate-500"
        )}>
          {streak}d
        </span>
      </div>
    );
  }

  // Build weekly dots (last 7 days visualization)
  const weekDots = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7));

  return (
    <div className="rpg-card rounded-2xl p-5 sparkle-hover relative overflow-hidden">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.04] border border-white/[0.07]">
          <Flame className={cn(
            "w-5 h-5",
            isBlazing ? "text-orange-300" : isHot ? "text-orange-400" : "text-slate-500"
          )} />
        </div>

        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              "text-3xl font-bold tabular-nums leading-none tracking-tight",
              isBlazing ? "text-orange-300" : isHot ? "text-orange-400" : "text-white"
            )}>
              {streak}
            </span>
            <span className="text-sm text-slate-500 font-medium">day streak</span>
          </div>

          {/* Week dots */}
          <div className="flex items-center gap-1.5 mt-2">
            {weekDots.map((active, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-150",
                  active
                    ? isHot
                      ? "bg-orange-400"
                      : "bg-indigo-500"
                    : "bg-white/[0.08]"
                )}
              />
            ))}
            <span className="text-xs text-slate-500 ml-1 font-medium">this week</span>
          </div>
        </div>

        {/* Streak freeze indicator */}
        {streak >= 7 && (
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-full px-2 py-1 flex-shrink-0">
            <Snowflake className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-400">
              {streak >= 30 ? "2" : "1"} freeze{streak >= 30 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
