"use client";

import { motion } from "framer-motion";
import { xpProgressInCurrentLevel, calculateLevel } from "@/lib/xp";
import { Zap, Shield, ChevronRight } from "lucide-react";
import AnimatedCounter from "@/components/effects/AnimatedCounter";
import { cn } from "@/lib/utils";

interface XPBarProps {
  totalXp: number;
  compact?: boolean;
}

export default function XPBar({ totalXp, compact = false }: XPBarProps) {
  const level = calculateLevel(totalXp);
  const { current, needed, percentage } = xpProgressInCurrentLevel(totalXp);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-full px-2.5 py-0.5">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className="text-xs font-bold text-amber-400">Lv.{level}</span>
        </div>
        <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-amber-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rpg-card rounded-2xl p-5 sparkle-hover relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Level badge with SVG ring */}
            <div className="relative">
              <div className="w-14 h-14 relative">
                <svg width="56" height="56" className="absolute inset-0 -rotate-90">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="3" />
                  <motion.circle
                    cx="28" cy="28" r="24"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - percentage / 100) }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-[5px] bg-white/[0.04] border border-white/[0.07] rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Level</div>
              <AnimatedCounter
                value={level}
                duration={0.8}
                format={false}
                className="font-bold text-white text-2xl leading-none tabular-nums tracking-tight"
              />
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-0.5">XP Progress</div>
            <div className="text-sm font-bold text-amber-400 tabular-nums">
              <AnimatedCounter value={current} duration={1} className="" />
              <span className="text-slate-600 mx-1">/</span>
              <span className="text-slate-400">{needed.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="relative w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-amber-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>

        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate-500 font-medium">Lv.{level}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 font-medium">Lv.{level + 1}</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
