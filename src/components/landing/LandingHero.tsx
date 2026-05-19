"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingHeroVisual from "@/components/landing/LandingHeroVisual";

export default function LandingHero() {
  return (
    <section className="container mx-auto px-6 pt-20 pb-24 max-w-6xl relative">
      <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* ── Left: text column ── */}
        <div className="flex flex-col items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-5 py-2 mb-8 text-sm text-indigo-300 backdrop-blur-sm sparkle-hover"
          >
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            AI-Powered Learning RPG
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-indigo-500 hover:bg-indigo-400 text-white font-medium text-lg px-10 py-7 transition-colors duration-150"
              >
                Start Your Quest <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700/50 text-slate-300 hover:bg-white/5 hover:border-slate-500 text-lg px-10 py-7 transition-colors duration-150"
              >
                Sign In
              </Button>
            </Link>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex items-center gap-3 mt-10 flex-wrap"
          >
            {[
              { label: "XP System", icon: "⚡" },
              { label: "5 Mastery Tiers", icon: "🏆" },
              { label: "AI Grading", icon: "🧠" },
              { label: "Exam Prep", icon: "📝" },
            ].map(({ label, icon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.1, type: "spring" }}
                className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/40 border border-slate-700/30 rounded-full px-4 py-2 backdrop-blur-sm"
              >
                <span className="text-base">{icon}</span>
                <span className="font-medium">{label}</span>
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
