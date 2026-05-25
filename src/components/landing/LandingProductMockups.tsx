"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import {
  Skull,
  Zap,
  Play,
  CheckCircle,
  Lock,
  Star,
  Trophy,
  RotateCcw,
  CalendarDays,
  Timer,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBossFightDemo } from "@/components/landing/useBossFightDemo";

// ─── Shared micro-utility ────────────────────────────────────────────────────
// MiniPixelXpBar — small segmented pixel arcade bar that mirrors .pixel-xp-bar
// at a mockup-friendly size. Real dashboard uses the full .pixel-xp-bar class.

function MiniPixelXpBar({ pct }: { pct: number }) {
  return (
    <div className="pixel-xp-bar">
      <div className="pixel-xp-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Dashboard mock — mirrors the real dashboard hero HUD ────────────────────

function DashboardMock() {
  return (
    <div className="space-y-3">
      {/* Welcome bar — pixel-bordered level tile (compact .hud-level-frame look) */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-pixel text-[8px] tracking-wider text-slate-500">
            WELCOME BACK
          </p>
          <p className="text-xs font-bold text-white mt-0.5">Scholar</p>
        </div>
        <div
          className="w-11 h-11 pixel-border bg-slate-950 text-amber-400 flex flex-col items-center justify-center shrink-0"
          aria-label="Level 3"
        >
          <span className="font-pixel text-[6px] tracking-wider opacity-80">LVL</span>
          <span className="font-pixel text-[12px] tracking-tight tabular-nums leading-none mt-0.5">3</span>
        </div>
      </div>

      {/* Pixel XP bar — segmented arcade bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="font-pixel text-[8px] tracking-wider text-amber-500/70">XP</span>
          <span className="font-pixel text-[9px] tracking-wider text-amber-400 tabular-nums">210/300</span>
        </div>
        <MiniPixelXpBar pct={70} />
      </div>

      {/* Mini quest card — pixel-bordered, mirrors Today's Mission style */}
      <div className="pixel-border bg-indigo-500/10 text-indigo-500/80 px-3 py-2 flex items-center gap-2">
        <div className="w-6 h-6 pixel-border bg-indigo-500 text-white flex items-center justify-center flex-shrink-0">
          <Zap className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="font-pixel text-[8px] tracking-wider text-indigo-300/90 mb-0.5">CONTINUE QUEST</p>
          <p className="text-[9px] text-slate-400 truncate">Photosynthesis · 2 left</p>
        </div>
      </div>
    </div>
  );
}

// ─── Course map mock ─────────────────────────────────────────────────────────

function MapMock() {
  const topics = [
    { title: "Cell Biology", mastery: 5, icon: <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />, color: "text-amber-400", border: "border-amber-400/30 bg-amber-950/20" },
    { title: "Photosynthesis", mastery: 2, icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />, color: "text-emerald-400", border: "border-green-500/25 bg-green-950/20" },
    { title: "Genetics", mastery: 0, icon: <Play className="w-3 h-3 text-indigo-400" />, color: "text-indigo-400", border: "border-slate-700/40 bg-slate-900/50" },
    { title: "Ecosystems", mastery: -1, icon: <Lock className="w-3 h-3 text-slate-600" />, color: "text-slate-600", border: "border-slate-800/30 bg-slate-900/20 opacity-40" },
  ];

  return (
    <div className="space-y-1.5">
      {/* Episode header — pixel-bordered episode number (matches real CourseMap) */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 pixel-border bg-indigo-500 text-white flex items-center justify-center text-xs font-extrabold flex-shrink-0">
          1
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-pixel text-[7px] tracking-wider text-indigo-400/90">EPISODE 1</div>
          <p className="text-[10px] font-bold text-white truncate">Biology</p>
          <MiniPixelXpBar pct={50} />
        </div>
      </div>

      {topics.map((t) => (
        <div
          key={t.title}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${t.border}`}
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.07] flex-shrink-0">
            {t.icon}
          </div>
          <p className={`text-[10px] font-semibold truncate ${t.color}`}>{t.title}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Boss fight mock ─────────────────────────────────────────────────────────

function BossMock() {
  // Compact interactive boss fight — same mechanic as BossVisual but in a
  // smaller mockup card. Each click on ENGAGE BOSS drops HP; at 0% the card
  // flips to a victory state with TRY AGAIN.
  const { hp, isVictory, damageEvents, handleHit, reset } = useBossFightDemo();

  const hpClass =
    hp > 50
      ? "bg-red-600"
      : hp > 20
      ? "bg-orange-500"
      : "bg-red-500 animate-pulse";
  const hpTextClass = hp > 50 ? "text-red-400" : hp > 20 ? "text-orange-400" : "text-red-300";

  return (
    <div className="space-y-3">
      {/* Boss tile — flips to Trophy on victory */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-3 pixel-border transition-colors duration-300",
          isVictory ? "bg-green-950/30 text-green-500/60" : "bg-red-950/10 text-red-500/60"
        )}
      >
        <motion.div
          key={isVictory ? "trophy" : `skull-${100 - hp}`}
          initial={isVictory ? { scale: 0.6, rotate: -8 } : { scale: 0.92 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={
            isVictory
              ? { type: "spring", damping: 10, stiffness: 220 }
              : { duration: 0.18, ease: "easeOut" }
          }
          className={cn(
            "w-10 h-10 pixel-border text-white flex items-center justify-center flex-shrink-0",
            isVictory ? "bg-green-500" : "bg-red-600"
          )}
        >
          {isVictory ? <Trophy className="w-5 h-5" /> : <Skull className="w-5 h-5" />}
        </motion.div>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-pixel text-[7px] tracking-wider mb-0.5 transition-colors",
              isVictory ? "text-green-400/90" : "text-red-400/90"
            )}
          >
            {isVictory ? "VICTORY" : "BOSS FIGHT"}
          </div>
          <p className="text-xs font-extrabold text-white">
            {isVictory ? "Boss Defeated!" : "Episode Boss"}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {isVictory ? "+150 XP earned" : "13 trials · All topics"}
          </p>
        </div>
      </div>

      {/* Boss HP bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="font-pixel text-[8px] tracking-wider text-slate-500">BOSS HP</span>
          <span className={cn("font-pixel text-[9px] tracking-wider tabular-nums transition-colors", hpTextClass)}>
            {hp}%
          </span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-[2px] overflow-hidden border border-red-500/20">
          <motion.div
            className={cn("h-full origin-left", hpClass)}
            initial={{ width: "100%" }}
            animate={{ width: `${hp}%` }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* CTA + damage popups */}
      <div className="relative">
        <AnimatePresence>
          {damageEvents.map((dmg) => (
            <motion.div
              key={dmg.id}
              aria-hidden
              className="absolute left-1/2 -top-1 pointer-events-none font-pixel text-[11px] tracking-wider text-red-400"
              style={{ x: dmg.xOffset - 12 }}
              initial={{ opacity: 0, y: 0, scale: 0.85 }}
              animate={{ opacity: [0, 1, 1, 0], y: -48, scale: 1.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1], times: [0, 0.12, 0.65, 1] }}
            >
              -{dmg.amount}
            </motion.div>
          ))}
        </AnimatePresence>

        {!isVictory ? (
          <div className="w-full transition-transform duration-100 hover:translate-y-0.5 active:translate-y-1">
            <button
              type="button"
              onClick={handleHit}
              className="w-full py-2.5 bg-amber-500 text-slate-950 font-pixel text-[9px] tracking-wider flex items-center justify-center gap-1.5 shadow-[0_3px_0_0_#78350f] hover:shadow-[0_1.5px_0_0_#78350f] active:shadow-[0_0_0_0_#78350f]"
            >
              <Skull className="w-3.5 h-3.5" />
              ENGAGE BOSS
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="w-full py-2.5 bg-green-500 text-slate-950 font-pixel text-[9px] tracking-wider flex items-center justify-center gap-1.5 shadow-[0_3px_0_0_#14532d] glow-green">
              <Trophy className="w-3.5 h-3.5" />
              VICTORY!
            </div>
          </motion.div>
        )}
      </div>

      {!isVictory ? (
        <p className="font-pixel text-[7px] tracking-wider text-slate-600 text-center">COMPLETE TOPICS TO UNLOCK</p>
      ) : (
        <button
          type="button"
          onClick={reset}
          className="mx-auto flex items-center gap-1.5 text-[8px] font-pixel tracking-wider text-slate-500 hover:text-green-300 transition-colors"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          TRY AGAIN
        </button>
      )}
    </div>
  );
}

// ─── Exam Prep mock ──────────────────────────────────────────────────────────
// Mirrors the per-course Exam Prep landing — countdown chip + "Past Exam
// Prep" header + the two CTAs (Untimed Practice / Timed Exam). The point
// of this mockup is to communicate that StudyQuest is also an exam tool,
// not just a daily-quiz toy.

function ExamMock() {
  return (
    <div className="space-y-3">
      {/* Header row — course name + countdown chip (the "12 DAYS LEFT" tile
          students obsess over). Matches ExamCountdownCard's identity. */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-pixel text-[7px] tracking-wider text-slate-500 flex items-center gap-1">
            <CalendarDays className="w-2.5 h-2.5" />
            FINAL · MON, JUL 27
          </p>
          <p className="text-xs font-bold text-white mt-0.5 truncate">
            Comp Models
          </p>
        </div>
        <div
          className="shrink-0 inline-flex flex-col items-center justify-center px-2 py-1.5 pixel-border bg-slate-950/40 text-orange-300"
          aria-label="12 days left"
        >
          <span className="text-base font-extrabold tabular-nums leading-none">
            12
          </span>
          <span className="font-pixel text-[6px] tracking-wider opacity-80 mt-0.5">
            DAYS LEFT
          </span>
        </div>
      </div>

      {/* Eyebrow + tiny stat row matching the real exam landing chrome */}
      <div className="space-y-1.5">
        <p className="font-pixel text-[7px] tracking-wider text-amber-400/90">
          PAST EXAM PREP
        </p>
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span className="flex items-center gap-1">
            <BookOpen className="w-2.5 h-2.5" />
            18 questions
          </span>
          <span className="text-slate-700">·</span>
          <span>2 hours</span>
        </div>
      </div>

      {/* The two CTAs — Untimed (indigo, low-pressure) + Timed (amber,
          real-exam pressure). Matches the actual exam landing's two-button
          row exactly. */}
      <div className="space-y-1.5 pt-1">
        <div className="pixel-border bg-indigo-500/10 text-indigo-300 px-2.5 py-1.5 flex items-center gap-2">
          <BookOpen className="w-3 h-3 flex-shrink-0" />
          <span className="font-pixel text-[8px] tracking-wider">
            UNTIMED PRACTICE
          </span>
        </div>
        <div className="pixel-border bg-amber-500/10 text-amber-300 px-2.5 py-1.5 flex items-center gap-2">
          <Timer className="w-3 h-3 flex-shrink-0" />
          <span className="font-pixel text-[8px] tracking-wider">
            TIMED EXAM
          </span>
        </div>
      </div>

      {/* Tiny outcome promise — matches the AI debrief output */}
      <p className="font-pixel text-[7px] tracking-wider text-slate-600 text-center pt-0.5">
        AI DEBRIEF · PREDICTED SCORE · GAPS
      </p>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

const mockups = [
  {
    title: "Dashboard",
    caption: "Your dashboard",
    component: <DashboardMock />,
  },
  {
    title: "Course Map",
    caption: "Course map",
    component: <MapMock />,
  },
  {
    title: "Boss Fight",
    caption: "Boss fight",
    component: <BossMock />,
  },
  {
    title: "Exam Prep",
    caption: "Past exam prep",
    component: <ExamMock />,
  },
];

export default function LandingProductMockups() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-30% 0px -30% 0px" });

  return (
    <section ref={sectionRef} className="container mx-auto px-6 py-20">
      <div className="text-center mb-14">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="font-pixel text-[9px] tracking-wider text-indigo-400 mb-3"
        >
          PRODUCT PREVIEW
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-3xl md:text-4xl font-bold text-white mb-4"
        >
          See What You&apos;re Walking Into
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-slate-400 max-w-md mx-auto text-sm"
        >
          Four surfaces, one coherent adventure. Your dashboard, your map,
          the boss waiting at the end of every chapter, and the past-exam
          prep mode when finals close in.
        </motion.p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {mockups.map(({ title, caption, component }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.55, delay: 0.3 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="group flex flex-col gap-3"
          >
            <div className="rpg-card rounded-2xl p-5 tilt-card sparkle-hover flex-1 relative overflow-hidden">
              {/* Indigo accent line + pixel nails — mockup chrome ties to family */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
              <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
              <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
              <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
              <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />

              <div className="relative z-[1]">
                {/* Mini window chrome */}
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  <span className="ml-2 font-pixel text-[8px] tracking-wider text-slate-500">
                    {title.toUpperCase()}
                  </span>
                </div>

                {/* Mock content */}
                {component}
              </div>
            </div>

            {/* Caption */}
            <p className="font-pixel text-[9px] tracking-wider text-slate-500 text-center">{caption.toUpperCase()}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
