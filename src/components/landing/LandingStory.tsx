"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
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
    <div className="rpg-card rounded-2xl p-5 space-y-4 w-72">
      {/* Drop zone */}
      <div className="border-2 border-dashed border-indigo-500/30 rounded-xl p-6 flex flex-col items-center gap-2 bg-indigo-500/5">
        <FileText className="w-8 h-8 text-indigo-400" />
        <p className="text-xs text-slate-400 font-medium">Drop your PDF here</p>
      </div>

      {/* Uploaded file row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2"
      >
        <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">course.pdf</p>
          <p className="text-[10px] text-slate-500">5 MB</p>
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
          <span className="text-amber-400 font-bold tabular-nums">{count}</span> questions
        </p>
      </motion.div>
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
    <div className="rpg-card rounded-2xl p-5 space-y-2 w-72">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-xs font-extrabold text-white">
          1
        </div>
        <p className="text-xs font-bold text-white">Episode 1 · Biology</p>
      </div>

      {MAP_TOPICS.map((t) => (
        <motion.div
          key={t.title}
          initial={{ opacity: 0, x: -12 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: t.delay + 0.3, duration: 0.3 }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${t.border}`}
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
    <div className="rpg-card rounded-2xl p-5 space-y-4 w-72">
      {/* XP bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" /> XP Progress
          </span>
          <span className="text-amber-400 font-bold">Lv.3</span>
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full xp-shimmer rounded-full"
            initial={{ width: "0%" }}
            animate={inView ? { width: "78%" } : {}}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>234 XP</span>
          <span>300 XP</span>
        </div>
      </div>

      {/* XP pill burst */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ delay: 0.9, type: "spring", damping: 10 }}
        className="flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-5 py-2"
      >
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-amber-400 font-bold text-sm">+25 XP earned!</span>
      </motion.div>

      {/* Correct answer indicator */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 1.2 }}
        className="flex items-center gap-2 text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2"
      >
        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
        <span>Correct! Photosynthesis mastered.</span>
      </motion.div>
    </div>
  );
}

// ─── Section 4: Boss fight ────────────────────────────────────────────────────

function BossVisual({ inView }: { inView: boolean }) {
  return (
    <div className="rpg-card rounded-2xl p-5 space-y-4 w-72">
      {/* Boss tile */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ delay: 0.3, type: "spring", damping: 14 }}
        className="flex items-center gap-3 px-4 py-4 rounded-xl border border-red-500/30 bg-red-950/15"
      >
        <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Skull className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-white">Episode Boss Fight</p>
          <p className="text-xs text-slate-400 mt-0.5">13 trials · Cover all topics</p>
        </div>
      </motion.div>

      {/* HP bar */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-500">Boss HP</span>
          <span className="text-red-400 font-bold">100%</span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-red-600 rounded-full w-full" />
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
        <span className="text-slate-400">Defeat the boss for</span>
        <span className="text-amber-400 font-bold">+150 XP</span>
      </motion.div>

      <button className="w-full py-2.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5">
        <Skull className="w-3.5 h-3.5" />
        Engage Boss
      </button>
    </div>
  );
}

// ─── Individual story section (each owns its own useInView hook) ─────────────

interface StorySectionData {
  label: string;
  title: string;
  body: string;
  Visual: (props: { inView: boolean }) => React.ReactNode;
  flip: boolean;
}

function StorySection({ label, title, body, Visual, flip }: StorySectionData) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <div
      ref={ref}
      className={`flex flex-col gap-10 md:flex-row md:items-center ${flip ? "md:flex-row-reverse" : ""}`}
    >
      {/* Text column */}
      <motion.div
        initial={{ opacity: 0, x: flip ? 30 : -30 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="flex-1 space-y-4"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
          {label}
        </span>
        <h3 className="text-2xl md:text-3xl font-bold text-white">{title}</h3>
        <p className="text-slate-400 leading-relaxed text-sm md:text-base">{body}</p>
      </motion.div>

      {/* Visual column */}
      <motion.div
        initial={{ opacity: 0, x: flip ? -30 : 30 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="flex justify-center md:justify-start flex-shrink-0"
      >
        <Visual inView={inView} />
      </motion.div>
    </div>
  );
}

// ─── Story sections data ──────────────────────────────────────────────────────

const SECTIONS: StorySectionData[] = [
  {
    label: "Step 1",
    title: "Upload Your Course",
    body: "Drop any PDF — lecture slides, textbooks, study guides. Claude AI reads every page and extracts all the testable concepts in seconds.",
    Visual: UploadVisual,
    flip: false,
  },
  {
    label: "Step 2",
    title: "AI Builds Your Map",
    body: "The AI organises topics into episodes with a visual course map. You can see exactly what you know, what you're working on, and what's coming next.",
    Visual: MapBuildVisual,
    flip: true,
  },
  {
    label: "Step 3",
    title: "Take Quizzes, Earn XP",
    body: "Every question you answer earns XP and raises your mastery level on that topic. AI grades open-answer questions with detailed personalised feedback.",
    Visual: XpVisual,
    flip: false,
  },
  {
    label: "Step 4",
    title: "Face the Episode Boss",
    body: "When you've covered all topics in an episode, a Boss Fight unlocks — 13 comprehensive questions that test everything at once. Defeat it and claim major XP.",
    Visual: BossVisual,
    flip: true,
  },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export default function LandingStory() {
  return (
    <section className="container mx-auto px-6 py-20 max-w-5xl">
      <div className="text-center mb-20">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">
          How It Works
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Your Quest Begins Here
        </h2>
        <p className="text-slate-400 max-w-md mx-auto text-sm">
          Four steps. One repeating cycle that turns any course into a compelling academic journey.
        </p>
      </div>

      <div className="space-y-32">
        {SECTIONS.map((section) => (
          <StorySection key={section.title} {...section} />
        ))}
      </div>
    </section>
  );
}
