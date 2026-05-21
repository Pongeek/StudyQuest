"use client";

// ─── LandingStory ────────────────────────────────────────────────────────────
// Sticky scrollytelling for the 4-step story. Desktop: visual column is pinned
// in place while step text scrolls past on the left; the right visual cross-
// fades between the 4 mini-cards based on which step is currently centered in
// the viewport. Mobile falls back to the inline stacked layout (sticky doesn't
// behave well in narrow viewports).

import { useRef, useEffect, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Skull, Zap, CheckCircle, Play, FileText } from "lucide-react";

// ─── Section 1: Upload your course ───────────────────────────────────────────

function UploadVisual({ inView }: { inView: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setCount(n);
      if (n >= 17) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <div className="relative bg-slate-900/95 pixel-border text-indigo-500/80 p-5 space-y-4 w-72">
      {/* Pixel nails */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />

      <div className="relative z-[1] space-y-4">
        {/* Drop zone */}
        <div className="pixel-border border-dashed text-indigo-500/40 bg-indigo-500/5 p-6 flex flex-col items-center gap-2">
          <FileText className="w-8 h-8 text-indigo-400" />
          <p className="font-pixel text-[9px] tracking-wider text-indigo-300/80">DROP YOUR PDF</p>
        </div>

        {/* Uploaded file row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3 pixel-border bg-white/[0.03] text-white/30 px-3 py-2"
        >
          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">course.pdf</p>
            <p className="font-pixel text-[8px] tracking-wider text-slate-500">5 MB</p>
          </div>
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        </motion.div>

        {/* Question count */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-xs text-slate-400">
            AI extracted{" "}
            <span className="font-pixel text-[12px] tracking-wider text-amber-400 tabular-nums">{count}</span>{" "}
            questions
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Section 2: AI builds your map ───────────────────────────────────────────

const MAP_TOPICS = [
  { title: "Cell Biology", color: "text-emerald-400", border: "border-green-500/25 bg-green-950/20", delay: 0 },
  { title: "Photosynthesis", color: "text-indigo-400", border: "border-indigo-500/25 bg-indigo-950/20", delay: 0.5 },
  { title: "Genetics", color: "text-blue-400", border: "border-blue-500/25 bg-blue-950/20", delay: 1.0 },
  { title: "Ecosystems", color: "text-purple-400", border: "border-purple-500/25 bg-purple-950/20", delay: 1.5 },
];

function MapBuildVisual({ inView }: { inView: boolean }) {
  return (
    <div className="relative bg-slate-900/95 pixel-border text-indigo-500/80 p-5 space-y-2 w-72">
      {/* Pixel nails */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 z-[1]" />

      <div className="relative z-[1] flex items-center gap-2 mb-3">
        <div className="w-8 h-8 pixel-border bg-indigo-500 text-white flex items-center justify-center text-xs font-extrabold">
          1
        </div>
        <div className="min-w-0">
          <div className="font-pixel text-[8px] tracking-wider text-indigo-400/90">EPISODE 1</div>
          <p className="text-xs font-bold text-white truncate">Biology</p>
        </div>
      </div>

      {MAP_TOPICS.map((t) => (
        <motion.div
          key={t.title}
          initial={{ opacity: 0, x: -12 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: t.delay + 0.3, duration: 0.3 }}
          className={`relative z-[1] flex items-center gap-2.5 px-3 py-2 rounded-xl border ${t.border}`}
        >
          <div className="w-5 h-5 rounded-full bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
            <Play className="w-2.5 h-2.5 text-indigo-400" />
          </div>
          <p className={`text-xs font-semibold ${t.color}`}>{t.title}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Section 3: Take quizzes, earn XP ────────────────────────────────────────

function XpVisual({ inView }: { inView: boolean }) {
  return (
    <div className="relative bg-slate-900/95 pixel-border text-amber-500/80 p-5 space-y-4 w-72">
      {/* Pixel nails */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[1]" />

      <div className="relative z-[1] space-y-4">
        {/* XP bar — segmented pixel arcade bar (matches real dashboard) */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="font-pixel text-[9px] tracking-wider text-amber-500/70 flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> XP PROGRESS
            </span>
            <span className="font-pixel text-[10px] tracking-wider text-amber-400 tabular-nums">LV.3</span>
          </div>
          <div className="pixel-xp-bar">
            <motion.div
              className="pixel-xp-bar-fill"
              initial={{ width: "0%" }}
              animate={inView ? { width: "78%" } : {}}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-pixel text-[8px] tracking-wider text-slate-600 tabular-nums">234 XP</span>
            <span className="font-pixel text-[8px] tracking-wider text-slate-600 tabular-nums">300 XP</span>
          </div>
        </div>

        {/* XP pill burst — pixel-bordered + pixel-font */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.9, type: "spring", damping: 10 }}
          className="flex items-center justify-center gap-2 pixel-border bg-amber-500/10 text-amber-400 px-5 py-2"
        >
          <Zap className="w-4 h-4" />
          <span className="font-pixel text-[11px] tracking-wider">+25 XP EARNED</span>
        </motion.div>

        {/* Correct answer indicator */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.2 }}
          className="flex items-center gap-2 text-xs text-green-300 pixel-border bg-green-500/10 px-3 py-2"
        >
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span>Correct! Photosynthesis mastered.</span>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Section 4: Boss fight ────────────────────────────────────────────────────

function BossVisual({ inView }: { inView: boolean }) {
  return (
    <div className="relative bg-slate-900/95 pixel-border text-red-500/80 p-5 space-y-4 w-72">
      {/* Pixel nails — red, boss fight signature */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-red-400 z-[1]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-red-400 z-[1]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 z-[1]" />

      <div className="relative z-[1] space-y-4">
        {/* Boss tile — pixel-bordered */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.3, type: "spring", damping: 14 }}
          className="flex items-center gap-3 px-4 py-4 pixel-border bg-red-950/15 text-red-500/60"
        >
          <div className="w-12 h-12 pixel-border bg-red-600 text-white flex items-center justify-center flex-shrink-0">
            <Skull className="w-6 h-6" />
          </div>
          <div>
            <div className="font-pixel text-[9px] tracking-wider text-red-400/90 mb-0.5">BOSS FIGHT</div>
            <p className="text-sm font-extrabold text-white">Episode Boss</p>
            <p className="text-xs text-slate-400 mt-0.5">13 trials · all topics</p>
          </div>
        </motion.div>

        {/* HP bar */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="font-pixel text-[8px] tracking-wider text-slate-500">BOSS HP</span>
            <span className="font-pixel text-[10px] tracking-wider text-red-400 tabular-nums">100%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-[2px] overflow-hidden border border-red-500/20">
            <div className="h-full bg-red-600 w-full" />
          </div>
        </div>

        {/* Reward preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-2 text-xs"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400">Defeat for</span>
          <span className="font-pixel text-[10px] tracking-wider text-amber-400 tabular-nums">+150 XP</span>
        </motion.div>

        {/* Chunky pixel-shadow Engage Boss CTA */}
        <div className="w-full transition-transform duration-100 hover:translate-y-0.5 active:translate-y-1">
          <button
            type="button"
            className="w-full py-3 bg-amber-500 text-slate-950 font-pixel text-[10px] tracking-wider flex items-center justify-center gap-1.5 shadow-[0_4px_0_0_#78350f] hover:shadow-[0_2px_0_0_#78350f] active:shadow-[0_0_0_0_#78350f]"
          >
            <Skull className="w-3.5 h-3.5" />
            ENGAGE BOSS
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section data ────────────────────────────────────────────────────────────

interface StoryStep {
  label: string;
  title: string;
  body: string;
  Visual: (props: { inView: boolean }) => React.ReactNode;
}

const STEPS: StoryStep[] = [
  {
    label: "STEP 1",
    title: "Upload Your Course",
    body: "Drop any PDF — lecture slides, textbooks, study guides. Claude AI reads every page and extracts all the testable concepts in seconds.",
    Visual: UploadVisual,
  },
  {
    label: "STEP 2",
    title: "AI Builds Your Map",
    body: "The AI organises topics into episodes with a visual course map. You can see exactly what you know, what you're working on, and what's coming next.",
    Visual: MapBuildVisual,
  },
  {
    label: "STEP 3",
    title: "Take Quizzes, Earn XP",
    body: "Every question you answer earns XP and raises your mastery level on that topic. AI grades open-answer questions with detailed personalised feedback.",
    Visual: XpVisual,
  },
  {
    label: "STEP 4",
    title: "Face the Episode Boss",
    body: "When you've covered all topics in an episode, a Boss Fight unlocks — 13 comprehensive questions that test everything at once. Defeat it and claim major XP.",
    Visual: BossVisual,
  },
];

// ─── StepText (left column) — tracks its own viewport position ───────────────

interface StepTextProps {
  step: StoryStep;
  index: number;
  onActiveChange: (index: number) => void;
}

function StepText({ step, index, onActiveChange }: StepTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Active = step's center is within the middle band of the viewport.
  // Wider margin (-30%) than before so adjacent steps still register during
  // fast scroll instead of leaving the visual blank.
  const inView = useInView(ref, { margin: "-30% 0px -30% 0px" });

  useEffect(() => {
    if (inView) onActiveChange(index);
  }, [inView, index, onActiveChange]);

  return (
    <div
      ref={ref}
      className="min-h-[70vh] flex flex-col justify-center space-y-4 py-12"
    >
      <motion.span
        initial={{ opacity: 0, y: 15 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0.35, y: 0 }}
        transition={{ duration: 0.4 }}
        className="font-pixel text-[9px] tracking-wider text-indigo-400 flex items-center gap-2"
      >
        <span className="inline-block w-3 h-3 bg-indigo-400" />
        {step.label}
      </motion.span>
      <motion.h3
        initial={{ opacity: 0, y: 15 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0.4, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="text-3xl md:text-4xl font-bold text-white tracking-tight"
      >
        {step.title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0.3, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-slate-400 leading-relaxed text-base md:text-lg max-w-md"
      >
        {step.body}
      </motion.p>
    </div>
  );
}

// ─── Mobile-only inline section (sticky doesn't play well in narrow viewports) ──

function MobileStepInline({ step, index }: { step: StoryStep; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <div ref={ref} className="space-y-6">
      <div className="space-y-3">
        <span className="font-pixel text-[9px] tracking-wider text-indigo-400 flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-indigo-400" />
          {step.label}
        </span>
        <h3 className="text-2xl font-bold text-white">{step.title}</h3>
        <p className="text-slate-400 leading-relaxed text-sm">{step.body}</p>
      </div>
      <div className="flex justify-center">
        <step.Visual inView={inView} />
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function LandingStory() {
  const [activeIndex, setActiveIndex] = useState(0);
  const ActiveVisual = STEPS[activeIndex].Visual;

  return (
    <section className="container mx-auto px-6 py-20 max-w-6xl">
      <div className="text-center mb-16 md:mb-20">
        <p className="font-pixel text-[9px] tracking-wider text-indigo-400 mb-3">
          HOW IT WORKS
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Your Quest Begins Here
        </h2>
        <p className="text-slate-400 max-w-md mx-auto text-sm">
          Four steps. One repeating cycle that turns any course into a compelling academic journey.
        </p>
      </div>

      {/* ── Desktop: sticky scrollytelling ──
          Grid cells stretch to match (default items-stretch), so the right
          column inherits the full height of the 4-step left column. Sticky
          element then has proper scroll room. */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-16 lg:gap-24">
        {/* Left column — step text blocks scroll normally */}
        <div>
          {STEPS.map((step, i) => (
            <StepText
              key={step.title}
              step={step}
              index={i}
              onActiveChange={setActiveIndex}
            />
          ))}
        </div>

        {/* Right column wrapper — full column height, sticky child pins to viewport */}
        <div className="relative">
          <div className="sticky top-[18vh] h-[64vh] flex items-center justify-center">
            <div className="relative w-72 flex items-center justify-center">
              <AnimatePresence initial={false}>
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.96, position: "absolute" }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ActiveVisual inView={true} />
                </motion.div>
              </AnimatePresence>

              {/* Step indicator dots — pixel chips on the right edge of the visual */}
              <div className="absolute -right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-[2]">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 transition-all duration-300 ${
                      i === activeIndex
                        ? "bg-amber-400"
                        : i < activeIndex
                        ? "bg-indigo-400"
                        : "bg-slate-700"
                    }`}
                    style={{
                      transform:
                        i === activeIndex
                          ? "rotate(45deg) scale(1.5)"
                          : "rotate(45deg)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: stacked inline (no sticky) ── */}
      <div className="md:hidden space-y-20">
        {STEPS.map((step, i) => (
          <MobileStepInline key={step.title} step={step} index={i} />
        ))}
      </div>
    </section>
  );
}
