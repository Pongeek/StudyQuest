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

/**
 * The Quest Board section — section header with amber biome ambient,
 * + a grid of QuestCards. First card is rendered as "featured".
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
        <span className="hidden sm:inline-flex items-center text-xs font-medium text-slate-500 bg-white/[0.03] border border-white/[0.07] rounded-full px-2.5 py-1">
          {recommendations.length} pending
        </span>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((rec, idx) => (
          <QuestCard
            key={rec.topicId}
            topicId={rec.topicId}
            topicTitle={rec.topicTitle}
            courseName={rec.courseName}
            href={`/dashboard/courses/${rec.courseId}/topics/${rec.topicId}`}
            masteryLevel={rec.masteryLevel}
            tier={tierFor(idx, rec.masteryLevel)}
          />
        ))}
      </div>
    </section>
  );
}
