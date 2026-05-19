"use client";

import Link from "next/link";
import { Skull } from "lucide-react";
import { cn } from "@/lib/utils";

interface GrimoireWidgetProps {
  demonCount: number;
}

export default function GrimoireWidget({ demonCount }: GrimoireWidgetProps) {
  const hasDemons = demonCount > 0;

  return (
    <Link href="/dashboard/grimoire" className="block group">
      <div
        className={cn(
          "rpg-card rounded-xl p-4 flex items-center gap-4 border transition-all duration-200",
          hasDemons
            ? "border-purple-800/50 hover:border-purple-600/70 hover:bg-purple-950/10"
            : "border-slate-800/50 hover:border-slate-700/60 opacity-60"
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all",
            hasDemons
              ? "bg-purple-950/60 border border-purple-700/40 glow-purple group-hover:scale-105"
              : "bg-slate-800/40 border border-slate-700/30"
          )}
        >
          📕
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Mistake Grimoire</p>
          {hasDemons ? (
            <p className="text-xs text-purple-400 flex items-center gap-1 mt-0.5">
              <Skull className="w-3 h-3" />
              {demonCount} demon{demonCount !== 1 ? "s" : ""} active
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">Grimoire is clear ✓</p>
          )}
        </div>

        {/* Arrow */}
        <span
          className={cn(
            "text-sm transition-transform group-hover:translate-x-0.5",
            hasDemons ? "text-purple-400" : "text-slate-600"
          )}
        >
          →
        </span>
      </div>
    </Link>
  );
}
