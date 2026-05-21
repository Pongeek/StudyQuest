"use client";

import { motion } from "framer-motion";
import { Swords } from "lucide-react";
import QuestCard, { type QuestTier } from "./QuestCard";

export interface QuestBoardRecommendation {
  topicId: string;
  topicTitle: string;
  courseId: string;
  courseName: string;
  masteryLevel: number;
}

interface QuestBoardProps {
  recommendations: QuestBoardRecommendation[];
}

function tierFor(index: number, masteryLevel: number): QuestTier {
  if (index === 0) return "featured";
  return masteryLevel >= 1 ? "priority" : "standard";
}

const gridContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Quest Board — section header + responsive 3-card grid of QuestCards.
 * First card is "featured" (recommended next action) → indigo pixel border +
 * CRT scanlines + pulsing RECOMMENDED stamp. Others are "priority" (weak
 * topic — amber border) or "standard" (new topic — indigo CTA on slate).
 *
 * Returns null when there are no recommendations so the caller doesn't
 * have to guard.
 */
export default function QuestBoard({ recommendations }: QuestBoardProps) {
  if (recommendations.length === 0) return null;

  return (
    <section
      aria-labelledby="quest-board-heading"
      className="biome-quest animate-slide-up"
      style={{ animationDelay: "0.2s" }}
    >
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
            <Swords className="w-4 h-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <h2
              id="quest-board-heading"
              className="text-lg sm:text-xl font-bold leading-none text-white tracking-tight"
            >
              Quest Board
            </h2>
            <p className="text-[13px] text-slate-500 mt-1">
              Active quests awaiting a champion
            </p>
          </div>
        </div>
        {/* Pixel pending counter — pairs with the new pixel quest cards */}
        <span
          className="hidden sm:inline-flex items-center font-pixel text-[9px] tracking-wider text-indigo-300 bg-indigo-500/10 border border-indigo-500/40 px-2 py-1.5"
          aria-label={`${recommendations.length} quests pending`}
        >
          {recommendations.length} PENDING
        </span>
      </header>

      <motion.div
        variants={gridContainer}
        initial="hidden"
        animate="show"
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {recommendations.map((rec, idx) => (
          <motion.div key={rec.topicId} variants={cardVariant} className="h-full">
            <QuestCard
              topicId={rec.topicId}
              topicTitle={rec.topicTitle}
              courseName={rec.courseName}
              href={`/dashboard/courses/${rec.courseId}/topics/${rec.topicId}`}
              masteryLevel={rec.masteryLevel}
              tier={tierFor(idx, rec.masteryLevel)}
            />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
