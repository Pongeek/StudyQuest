"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sword } from "lucide-react";
import LandingHeroVisual from "@/components/landing/LandingHeroVisual";

const FEATURE_PILLS: Array<{ label: string; icon: string; tone: string }> = [
  { label: "XP SYSTEM",       icon: "⚡", tone: "text-amber-400" },
  { label: "5 MASTERY TIERS", icon: "🏆", tone: "text-amber-400" },
  { label: "AI GRADING",      icon: "🧠", tone: "text-indigo-400" },
  { label: "EXAM PREP",       icon: "📝", tone: "text-emerald-400" },
];

export default function LandingHero() {
  return (
    <section className="container mx-auto px-6 pt-20 pb-24 max-w-6xl relative">
      <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* ── Left: text column ── */}
        <div className="flex flex-col items-start">
          {/* Eyebrow — rank-chip vocabulary, matches dashboard/profile heroes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rank-chip rank-chip-shimmer mb-8"
          >
            <span aria-hidden="true" className="opacity-50">&#9670;</span>
            <span>AI-POWERED LEARNING RPG</span>
            <span aria-hidden="true" className="opacity-50">&#9670;</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-6xl font-extrabold mb-6 leading-[1.1] tracking-tight"
          >
            Turn Studying into{" "}
            <span className="text-indigo-400">
              an Adventure
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-slate-400 mb-10 leading-relaxed"
          >
            Upload your course material. AI transforms it into an RPG-style quest with episodes,
            boss fights, and intelligent questions. Earn XP, level up, and master any subject.
          </motion.p>

          {/* CTAs — chunky pixel-shadow press buttons matching Today's Mission */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link
              href="/sign-up"
              className="pixel-focus outline-none transition-transform duration-100 hover:translate-y-0.5 active:translate-y-1"
            >
              <div className="px-6 py-4 flex items-center justify-center gap-2 font-pixel text-[11px] tracking-wider bg-indigo-500 text-white shadow-[0_4px_0_0_#312e81] hover:shadow-[0_2px_0_0_#312e81] active:shadow-[0_0_0_0_#312e81]">
                <Sword className="w-4 h-4" aria-hidden />
                START YOUR QUEST
                <ArrowRight className="w-4 h-4" aria-hidden />
              </div>
            </Link>
            <Link
              href="/sign-in"
              className="pixel-focus outline-none transition-transform duration-100 hover:translate-y-0.5 active:translate-y-1"
            >
              <div className="px-6 py-4 flex items-center justify-center gap-2 font-pixel text-[11px] tracking-wider pixel-border bg-slate-900/80 text-slate-300 shadow-[0_4px_0_0_#0f172a] hover:shadow-[0_2px_0_0_#0f172a] active:shadow-[0_0_0_0_#0f172a]">
                SIGN IN
              </div>
            </Link>
          </motion.div>

          {/* Feature pills — pixel-bordered pixel-font chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center gap-2.5 mt-10 flex-wrap"
          >
            {FEATURE_PILLS.map(({ label, icon, tone }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.1, type: "spring" }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 pixel-border bg-slate-900/60 ${tone}`}
              >
                <span className="text-[13px] leading-none" aria-hidden>{icon}</span>
                <span className="font-pixel text-[9px] tracking-wider">{label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ── Right: animated character visual ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex justify-center md:justify-end"
        >
          <LandingHeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
