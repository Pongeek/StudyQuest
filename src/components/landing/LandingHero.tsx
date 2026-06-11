"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, Sword } from "lucide-react";
import LandingHeroVisual from "@/components/landing/LandingHeroVisual";
import { clamp01, r, useScrubOn } from "@/components/landing/scrub";

// Exit progress for the cinematic handoff into Chapter 01: 0 while the hero
// fills the viewport, 1 once it has scrolled ~70% of a viewport upward. The
// content drifts up faster than natural scroll and dims — a camera pan down
// into the world. (CSS-var scrub, not framer — see the CLAUDE.md gotcha.)
const heroExit = (rect: DOMRect, vh: number) => clamp01(-rect.top / (vh * 0.7));

const FEATURE_PILLS: Array<{ label: string; icon: string; tone: string }> = [
  { label: "XP SYSTEM",       icon: "⚡", tone: "text-amber-400" },
  { label: "5 MASTERY TIERS", icon: "🏆", tone: "text-amber-400" },
  { label: "AI GRADING",      icon: "🧠", tone: "text-indigo-400" },
  { label: "EXAM PREP",       icon: "📝", tone: "text-emerald-400" },
];

// Word-by-word reveal for the H1 tagline. Last two words ("an Adventure")
// get the indigo accent; "Adventure" also earns the amber XP underline
// (`underline`) — a pixel bar that fills in after the word reveals.
const TAGLINE_WORDS: Array<{ text: string; tone?: string; underline?: boolean }> = [
  { text: "Turn" },
  { text: "Studying" },
  { text: "into" },
  { text: "an", tone: "text-indigo-400" },
  { text: "Adventure", tone: "text-indigo-400", underline: true },
];

const taglineContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const taglineWord = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// Parallax layer positions — deterministic so SSR + client agree.
// xPct/yPct are % of the hero section; size in px; tone drives color.
type Speck = { xPct: number; yPct: number; size: number; tone: string; pulse?: boolean };

// Deep background — small distant "stars", indigo + white, lower density
const BG_STARS: Speck[] = [
  { xPct: 8,  yPct: 18, size: 2, tone: "bg-indigo-300/40", pulse: true },
  { xPct: 22, yPct: 8,  size: 1, tone: "bg-white/40" },
  { xPct: 38, yPct: 32, size: 2, tone: "bg-indigo-300/30" },
  { xPct: 52, yPct: 14, size: 1, tone: "bg-white/30", pulse: true },
  { xPct: 68, yPct: 6,  size: 2, tone: "bg-indigo-400/35" },
  { xPct: 78, yPct: 26, size: 1, tone: "bg-white/35" },
  { xPct: 88, yPct: 12, size: 2, tone: "bg-indigo-300/40", pulse: true },
  { xPct: 12, yPct: 64, size: 1, tone: "bg-white/30" },
  { xPct: 30, yPct: 78, size: 2, tone: "bg-indigo-300/30" },
  { xPct: 46, yPct: 88, size: 1, tone: "bg-white/35", pulse: true },
  { xPct: 62, yPct: 72, size: 2, tone: "bg-indigo-400/35" },
  { xPct: 82, yPct: 84, size: 1, tone: "bg-white/30" },
];

// Foreground — closer "rune motes", amber + indigo, drift in front of content
const FG_MOTES: Speck[] = [
  { xPct: 14, yPct: 36, size: 3, tone: "bg-amber-400/60", pulse: true },
  { xPct: 28, yPct: 56, size: 2, tone: "bg-indigo-400/55" },
  { xPct: 40, yPct: 22, size: 3, tone: "bg-amber-400/55", pulse: true },
  { xPct: 56, yPct: 48, size: 2, tone: "bg-amber-300/55" },
  { xPct: 72, yPct: 38, size: 3, tone: "bg-indigo-400/55", pulse: true },
  { xPct: 86, yPct: 58, size: 2, tone: "bg-amber-400/50" },
  { xPct: 18, yPct: 82, size: 3, tone: "bg-amber-400/55" },
  { xPct: 64, yPct: 78, size: 2, tone: "bg-indigo-400/50", pulse: true },
];

export default function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  // Exit handoff — writes --p (0→1) on the section as the user descends.
  useScrubOn(sectionRef, heroExit, reduceMotion ?? false);

  // Scroll progress through the hero (0 at top of hero, 1 when bottom hits top).
  // Drives the parallax layer offsets.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Background drifts DOWN as we scroll up = slower than content (deep / far)
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  // Foreground drifts UP faster than content (near / drifting forward)
  const fgY = useTransform(scrollYProgress, [0, 1], [0, -160]);

  return (
    <section
      ref={sectionRef}
      style={{ ["--p" as string]: 0 }}
      className="container mx-auto px-6 pt-12 pb-20 md:pb-24 max-w-6xl relative min-h-[calc(100svh-6rem)] flex flex-col justify-center"
    >
      {/* ── Parallax depth: background "stars" layer (slower) ── */}
      {!reduceMotion && (
        <motion.div
          aria-hidden
          style={{ y: bgY }}
          className="hidden md:block absolute inset-0 z-0 pointer-events-none"
        >
          {BG_STARS.map((s, i) => (
            <span
              key={`bg-${i}`}
              className={`absolute rounded-full ${s.tone} ${s.pulse ? "motion-safe:animate-pulse" : ""}`}
              style={{
                left: `${s.xPct}%`,
                top: `${s.yPct}%`,
                width: s.size,
                height: s.size,
              }}
            />
          ))}
        </motion.div>
      )}

      <div
        style={{
          opacity: `calc(1 - ${r(0.05, 0.85)} * 0.9)`,
          transform: `translateY(calc(${r(0, 1)} * -70px)) scale(calc(1 - ${r(0, 1)} * 0.04))`,
        }}
        className="relative z-10 grid md:grid-cols-2 gap-12 md:gap-16 items-center"
      >
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
            variants={taglineContainer}
            initial="hidden"
            animate="show"
            className="text-5xl md:text-6xl xl:text-7xl font-extrabold mb-6 leading-[1.06] tracking-tight flex flex-wrap gap-x-[0.27em]"
          >
            {TAGLINE_WORDS.map((word, i) => (
              <span
                key={i}
                className={`relative inline-block overflow-hidden ${
                  word.underline ? "hero-xp-underline" : ""
                }`}
              >
                <motion.span
                  variants={taglineWord}
                  className={`inline-block ${word.tone ?? ""}`}
                >
                  {word.text}
                </motion.span>
              </span>
            ))}
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

          {/* Feature pills — pixel-bordered pixel-font chips. Equal-width
              2×2 / 1×4 grid so the row never orphan-wraps. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="grid grid-cols-2 gap-2.5 mt-10 w-full max-w-md"
          >
            {FEATURE_PILLS.map(({ label, icon, tone }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.1, type: "spring" }}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 pixel-border bg-slate-900/60 ${tone}`}
              >
                <span className="text-[13px] leading-none" aria-hidden>{icon}</span>
                <span className="font-pixel text-[9px] tracking-wider whitespace-nowrap">{label}</span>
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

      {/* ── Scroll cue — arcade "press ↓" hint anchoring the fold's bottom.
            Desktop only (mobile content already fills the fold). The outer
            div fades it fast on descent (framer owns the inner entrance
            opacity, so the scrub fade lives on a parent). */}
      <div
        aria-hidden
        style={{ opacity: `calc(1 - ${r(0, 0.2)})` }}
        className="hidden md:block absolute bottom-2 left-1/2 -translate-x-1/2"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          className="flex flex-col items-center gap-1.5 text-slate-600"
        >
          <span className="font-pixel text-[8px] tracking-[0.2em] motion-safe:animate-pulse [animation-duration:2.2s]">
            CHAPTER 01 AWAITS
          </span>
          <ChevronDown className="w-4 h-4 motion-safe:animate-bounce [animation-duration:2.2s]" />
        </motion.div>
      </div>

      {/* ── Parallax depth: foreground "rune motes" layer (faster) ──
          Sits in front of content with low-alpha colors + pointer-events-none
          so it adds drifting depth without blocking clicks. */}
      {!reduceMotion && (
        <motion.div
          aria-hidden
          style={{ y: fgY }}
          className="hidden md:block absolute inset-0 z-20 pointer-events-none"
        >
          {FG_MOTES.map((s, i) => (
            <span
              key={`fg-${i}`}
              className={`absolute ${s.tone} ${s.pulse ? "motion-safe:animate-pulse" : ""}`}
              style={{
                left: `${s.xPct}%`,
                top: `${s.yPct}%`,
                width: s.size,
                height: s.size,
                // Rotated squares feel like rune particles (pixel-art motif)
                transform: "rotate(45deg)",
                filter: "blur(0.3px)",
              }}
            />
          ))}
        </motion.div>
      )}
    </section>
  );
}
