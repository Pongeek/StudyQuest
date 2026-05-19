"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Trophy, Zap, ArrowRight, CheckCircle, XCircle,
  RotateCcw, Target, AlertTriangle, Clock, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Confetti from "@/components/effects/Confetti";
import AnimatedCounter from "@/components/effects/AnimatedCounter";
import MarkdownContent from "@/components/quiz/MarkdownContent";

function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

interface AnswerResult {
  questionId: string;
  question: string;
  userAnswer: string;
  score: number;
  feedback: string;
  modelAnswer?: string;
  marks: number;
  type?: "mcq" | "open";
  options?: string[];
  correctAnswer?: string;
}

interface ExamDebriefProps {
  courseId: string;
  examTitle: string;
  predictedScore: number;
  examReadiness: string;
  strongestAreas: string[];
  criticalGaps: string[];
  recommendedTopics: string[];
  summary: string;
  xpEarned: number;
  results: AnswerResult[];
  elapsedSeconds: number;
  mode: "timed" | "assisted";
}

const READINESS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "Not Ready" },
  moderate: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", label: "Moderate" },
  high: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", label: "Almost Ready" },
  ready: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Exam Ready!" },
};

export default function ExamDebrief({
  courseId,
  examTitle,
  predictedScore,
  examReadiness,
  strongestAreas,
  criticalGaps,
  recommendedTopics,
  summary,
  xpEarned,
  results,
  elapsedSeconds,
  mode,
}: ExamDebriefProps) {
  const router = useRouter();
  const readiness = READINESS_CONFIG[examReadiness] || READINESS_CONFIG.moderate;
  const rtl = results.some((r) => isRTL(r.question));
  const minutes = Math.floor(elapsedSeconds / 60);

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir={rtl ? "rtl" : "ltr"}>
      {/* Confetti on good score */}
      {predictedScore >= 70 && <Confetti trigger={1} count={100} duration={3500} />}

      {/* Score hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="rpg-card rounded-2xl p-6 sm:p-10 text-center"
      >
        <div className="text-4xl sm:text-6xl mb-4">📝</div>
        <div className={cn(
          "text-4xl sm:text-5xl font-bold mb-2 animate-score-burst tabular-nums tracking-tight",
          predictedScore >= 70 ? "text-emerald-400" : "text-white"
        )}>
          <AnimatedCounter value={Math.round(predictedScore)} suffix="%" duration={1.5} delay={0.2} />
        </div>
        <p className="text-slate-400 text-sm mb-1">Predicted Exam Score</p>
        <div className={cn("inline-flex items-center gap-2 text-sm font-bold mb-4", readiness.color)}>
          <Target className="w-4 h-4" />
          {readiness.label}
        </div>

        <div className="flex items-center justify-center gap-4 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-full px-5 py-2.5"
          >
            <Zap className="w-5 h-5 text-amber-400" />
            <AnimatedCounter
              value={xpEarned}
              prefix="+"
              suffix=" XP"
              duration={1.2}
              delay={0.5}
              className="text-amber-400 font-bold text-base tabular-nums"
            />
          </motion.div>
          {mode === "timed" && (
            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-full px-4 py-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 text-sm font-medium">{minutes}m</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* AI Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rpg-card rounded-2xl p-5 sm:p-6 space-y-5"
      >
        <h2 className="font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          Exam Analysis
        </h2>

        <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>

        {strongestAreas.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-2">Strongest Areas</p>
            <ul className="space-y-1.5">
              {strongestAreas.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {criticalGaps.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-2">Critical Gaps</p>
            <ul className="space-y-1.5">
              {criticalGaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}

        {recommendedTopics.length > 0 && (
          <div className="bg-indigo-500/10 border border-indigo-500/15 rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-2">Study these topics before your exam</p>
            <ul className="space-y-1">
              {recommendedTopics.map((t, i) => (
                <li key={i} className="text-sm font-bold text-indigo-300">{t}</li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      {/* Per-question breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rpg-card rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <h2 className="font-bold text-white">Question Breakdown</h2>
        {results.map((r, i) => {
          const qRtl = isRTL(r.question);
          const scoreColor = r.score >= 0.7 ? "text-green-400" : "text-red-400";
          const scoreBg = r.score >= 0.7
            ? "border-green-500/20 bg-green-500/5"
            : "border-red-500/20 bg-red-500/5";
          const isMcq = r.type === "mcq" && Array.isArray(r.options) && r.options.length > 0;

          return (
            <div
              key={r.questionId}
              className={cn("rounded-xl border overflow-hidden", scoreBg)}
            >
              {/* Score badge header */}
              <div className={cn(
                "flex items-center justify-between px-4 py-2.5 border-b",
                r.score >= 0.7 ? "border-green-500/15" : "border-red-500/15"
              )}>
                <div className="flex items-center gap-2">
                  {r.score >= 0.7 ? (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-300">Q{i + 1}</span>
                  {isMcq && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      MCQ
                    </span>
                  )}
                </div>
                <span className={cn("text-xs font-bold tabular-nums", scoreColor)}>
                  {Math.round(r.score * 100)}% · {r.marks} mark{r.marks !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Question */}
              <div className="px-4 pt-4 pb-2" dir={qRtl ? "rtl" : "ltr"}>
                <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-1.5">Question</p>
                <MarkdownContent className="text-sm text-white font-semibold">
                  {r.question}
                </MarkdownContent>
              </div>

              {/* MCQ: option list with state styling */}
              {isMcq ? (
                <div className="px-4 pt-2 pb-3 space-y-1.5" dir={qRtl ? "rtl" : "ltr"}>
                  {(r.options as string[]).map((option) => {
                    const isCorrectOption = option === r.correctAnswer;
                    const isUserWrong =
                      option === r.userAnswer && option !== r.correctAnswer;
                    const letterMatch = option.match(/^([A-D])\.\s*/);
                    const letter = letterMatch ? letterMatch[1] : option[0];
                    const body = letterMatch ? option.slice(letterMatch[0].length) : option;

                    return (
                      <div
                        key={option}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition-none",
                          qRtl && "flex-row-reverse",
                          isCorrectOption &&
                            "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
                          isUserWrong &&
                            "border-red-500/50 bg-red-500/10 text-red-300 line-through",
                          !isCorrectOption &&
                            !isUserWrong &&
                            "border-white/[0.06] bg-white/[0.01] text-slate-500 opacity-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold",
                            isCorrectOption && "bg-emerald-500/25 text-emerald-300",
                            isUserWrong && "bg-red-500/25 text-red-300",
                            !isCorrectOption && !isUserWrong && "bg-white/[0.04] text-slate-500"
                          )}
                        >
                          {letter}
                        </span>
                        <span className="flex-1">{body}</span>
                        {isCorrectOption && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        )}
                        {isUserWrong && (
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Open: Your Answer */
                <div className="px-4 pt-2 pb-2" dir={qRtl ? "rtl" : "ltr"}>
                  <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-1.5">Your Answer</p>
                  {r.userAnswer ? (
                    <MarkdownContent className="text-sm text-slate-300">
                      {r.userAnswer}
                    </MarkdownContent>
                  ) : (
                    <p className="text-sm text-slate-600 italic">No answer provided</p>
                  )}
                </div>
              )}

              {/* Model Answer / Explanation — shown when present */}
              {r.modelAnswer && (
                <div className="px-4 pt-2 pb-2 mx-4 mb-2 rounded-lg bg-green-500/[0.06] border border-green-500/15" dir={qRtl ? "rtl" : "ltr"}>
                  <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-1.5">
                    {isMcq ? "Explanation" : "Model Answer"}
                  </p>
                  <MarkdownContent className="text-sm text-slate-200">
                    {r.modelAnswer}
                  </MarkdownContent>
                </div>
              )}

              {/* Feedback / AI Assessment */}
              <div className="px-4 pt-2 pb-4" dir={qRtl ? "rtl" : "ltr"}>
                <p className="text-[11px] uppercase tracking-wider font-medium text-slate-500 mb-1.5">AI Assessment</p>
                <MarkdownContent className="text-sm text-slate-300">
                  {r.feedback}
                </MarkdownContent>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Navigation — router.refresh() runs ON CLICK so the dashboard
          layout's cached `total_xp` / `current_streak` is invalidated just
          before navigation, refreshing the nav HUD on the destination. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Link
          href={`/dashboard/courses/${courseId}`}
          className="flex-1"
          onClick={() => router.refresh()}
        >
          <Button variant="outline" className="w-full border-white/[0.08] text-slate-300 gap-2 hover:bg-white/[0.04] hover:text-white">
            <RotateCcw className="w-4 h-4" /> Back to Course
          </Button>
        </Link>
        <Link
          href="/dashboard"
          className="flex-1"
          onClick={() => router.refresh()}
        >
          <Button className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium gap-2 transition-colors duration-150">
            Dashboard <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
