"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Brain,
  Check,
  X,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/quiz/MarkdownContent";
import MarkdownInline from "@/components/quiz/MarkdownInline";
import { XPBurstProvider, useXPBurst } from "@/components/effects/XPBurst";
import { useSound } from "@/lib/useSound";
import { REVIEW_XP_PER_CORRECT } from "@/lib/spaced-repetition";
import ReviewSummary from "./ReviewSummary";
import { type UnlockedAchievement } from "@/components/effects/AchievementUnlockOverlay";
import AnswerImagePicker from "@/components/quiz/AnswerImagePicker";

function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

interface ReviewQuestion {
  id: string;
  type: "mcq" | "open";
  content: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  difficulty: number;
  topicId: string;
  topicTitle: string;
}

interface QuestionState {
  selectedOption: string | null;
  openAnswer: string;
  /** Optional diagram image attached for this open question */
  openAnswerImage: File | null;
  result: {
    score: number;
    feedback: string;
    correct_answer: string;
    explanation: string;
  } | null;
  visited: boolean;
  skipped: boolean;
}

interface TopicResult {
  topicId: string;
  topicTitle: string;
  scorePct: number;
  oldInterval: number;
  newInterval: number;
  nextReviewAt: string;
  passed: boolean;
  evolved?: { fromLevel: number; toLevel: number } | null;
}

interface CompleteData {
  xpEarned: number;
  correctCount: number;
  totalCount: number;
  newStreak: number;
  perTopicResults: TopicResult[];
  newAchievements: UnlockedAchievement[];
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  newRank?: string;
}

interface ReviewEngineProps {
  sessionId: string;
  questions: ReviewQuestion[];
  userTotalXp: number;
  userStreak: number;
}

// ─── Inner engine ─────────────────────────────────────────────────────────────

function ReviewEngineInner({
  sessionId,
  questions,
  userStreak,
}: ReviewEngineProps) {
  const { fireBurst } = useXPBurst();
  const router = useRouter();
  const { play: playSfx } = useSound();

  const [questionStates, setQuestionStates] = useState<Map<string, QuestionState>>(() => {
    const map = new Map<string, QuestionState>();
    questions.forEach((q, i) => {
      map.set(q.id, {
        selectedOption: null,
        openAnswer: "",
        openAnswerImage: null,
        result: null,
        visited: i === 0,
        skipped: false,
      });
    });
    return map;
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isGrading, setIsGrading] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const navScrollRef = useRef<HTMLDivElement>(null);

  const [completeData, setCompleteData] = useState<CompleteData | null>(null);

  const currentQuestion = questions[currentIdx];

  const getQState = useCallback(
    (qId: string): QuestionState =>
      questionStates.get(qId) ?? {
        selectedOption: null,
        openAnswer: "",
        openAnswerImage: null,
        result: null,
        visited: false,
        skipped: false,
      },
    [questionStates]
  );

  const updateQState = useCallback((qId: string, patch: Partial<QuestionState>) => {
    setQuestionStates((prev) => {
      const next = new Map(prev);
      const current = next.get(qId) ?? {
        selectedOption: null,
        openAnswer: "",
        openAnswerImage: null,
        result: null,
        visited: false,
        skipped: false,
      };
      next.set(qId, { ...current, ...patch });
      return next;
    });
  }, []);

  const answeredCount = useMemo(
    () => Array.from(questionStates.values()).filter((s) => s.result !== null).length,
    [questionStates]
  );
  const unansweredCount = questions.length - answeredCount;

  const navigateTo = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= questions.length || targetIdx === currentIdx) return;
      if (isGrading) return;

      const curQ = questions[currentIdx];
      const curState = getQState(curQ.id);
      if (curState.visited && !curState.result) {
        updateQState(curQ.id, { skipped: true });
      }

      setNavDirection(targetIdx > currentIdx ? 1 : -1);
      setCurrentIdx(targetIdx);
      updateQState(questions[targetIdx].id, { visited: true });
      setShowFinishConfirm(false);
    },
    [currentIdx, questions, getQState, updateQState, isGrading]
  );

  const goNext = useCallback(() => navigateTo(currentIdx + 1), [currentIdx, navigateTo]);
  const goPrev = useCallback(() => navigateTo(currentIdx - 1), [currentIdx, navigateTo]);

  const submitAnswer = async () => {
    if (!currentQuestion) return;

    const qState = getQState(currentQuestion.id);
    const isOpen = currentQuestion.type !== "mcq";
    const userAnswer =
      currentQuestion.type === "mcq"
        ? qState.selectedOption ?? ""
        : qState.openAnswer.trim();
    const attachedImage = isOpen ? qState.openAnswerImage : null;

    if (!userAnswer && !attachedImage) {
      toast.error("Please type an answer or attach a diagram before submitting.");
      return;
    }

    setIsGrading(true);
    try {
      let res: Response;
      if (attachedImage) {
        const fd = new FormData();
        fd.append("questionId", currentQuestion.id);
        fd.append("userAnswer", userAnswer);
        fd.append("topicId", currentQuestion.topicId);
        fd.append("image", attachedImage);
        res = await fetch(`/api/review/${sessionId}/answer`, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(`/api/review/${sessionId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: currentQuestion.id,
            userAnswer,
            topicId: currentQuestion.topicId,
          }),
        });
      }

      if (!res.ok) throw new Error("Failed to grade answer");
      const { score, feedback } = await res.json();

      updateQState(currentQuestion.id, {
        result: {
          score,
          feedback,
          correct_answer: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation,
        },
        skipped: false,
      });

      if (score >= 0.7) {
        fireBurst({ amount: REVIEW_XP_PER_CORRECT });
        playSfx("correct");
        playSfx("xp", "normal");
      } else {
        playSfx("wrong");
      }
    } catch (err) {
      console.error("[ReviewEngine] answer grading failed:", err);
      toast.error("Failed to grade your answer. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  const completeSession = async () => {
    setIsGrading(true);
    setShowFinishConfirm(false);
    try {
      const res = await fetch(`/api/review/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Failed to complete session");
      const data = await res.json();
      setCompleteData(data);
      // NOTE: don't call `router.refresh()` here — it can re-trigger the
      // ReviewLauncher on /dashboard/review and start a fresh session
      // mid-summary. The summary's back-to-dashboard button calls it
      // just before navigation instead.
    } catch {
      toast.error("Failed to save your results.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleFinishClick = () => {
    if (unansweredCount > 0) {
      setShowFinishConfirm(true);
    } else {
      completeSession();
    }
  };

  // Show summary screen after completion
  if (completeData) {
    return (
      <ReviewSummary
        xpEarned={completeData.xpEarned}
        correctCount={completeData.correctCount}
        totalCount={completeData.totalCount}
        perTopicResults={completeData.perTopicResults}
        newAchievements={completeData.newAchievements}
        leveledUp={completeData.leveledUp}
        oldLevel={completeData.oldLevel}
        newLevel={completeData.newLevel}
        newRank={completeData.newRank}
      />
    );
  }

  if (!currentQuestion) return null;

  const curState = getQState(currentQuestion.id);
  const isAnswered = curState.result !== null;
  const isCorrect = isAnswered && curState.result!.score >= 0.7;
  const rtl = isRTL(currentQuestion.content);
  const difficultyStars = Array.from({ length: 5 }, (_, i) => i < currentQuestion.difficulty);

  // Topic color mapping for dots
  const uniqueTopicIds = Array.from(new Set(questions.map((q) => q.topicId)));
  const topicColorMap = new Map<string, string>();
  const topicColors = [
    "bg-cyan-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-rose-500",
  ];
  uniqueTopicIds.forEach((id, i) => {
    topicColorMap.set(id, topicColors[i % topicColors.length]);
  });

  const getDotStatus = (
    idx: number
  ): "current" | "correct" | "wrong" | "skipped" | "unanswered" => {
    if (idx === currentIdx) return "current";
    const q = questions[idx];
    const s = getQState(q.id);
    if (s.result) return s.result.score >= 0.7 ? "correct" : "wrong";
    if (s.skipped) return "skipped";
    return "unanswered";
  };

  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -40 }),
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ===== Navigator bar — cyan theme ===== */}
      <div className="rpg-card rounded-2xl overflow-hidden border-cyan-500/15">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/[0.06]">
          <motion.div
            className={cn(
              "h-full rounded-r-full",
              answeredCount === questions.length ? "bg-emerald-500" : "bg-cyan-500"
            )}
            animate={{ width: `${(answeredCount / questions.length) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span className="font-pixel text-[9px] text-cyan-400 uppercase tracking-widest">
                Training Mode
              </span>
            </div>
            <span className="text-sm font-bold text-slate-400 tabular-nums flex-shrink-0">
              <span className={cn(
                answeredCount === questions.length ? "text-green-400" : "text-cyan-400"
              )}>{answeredCount}</span>
              <span className="text-slate-600 mx-0.5">/</span>
              {questions.length}
            </span>
          </div>

          {/* Topic indicator for current question */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  topicColorMap.get(currentQuestion.topicId) ?? "bg-slate-500"
                )}
              />
              Reviewing: {currentQuestion.topicTitle}
            </span>
          </div>

          {/* Question dots + finish button */}
          <div className="flex items-center gap-2">
            <div
              ref={navScrollRef}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2 px-1 flex-1 min-w-0"
            >
              {questions.map((q, idx) => {
                const status = getDotStatus(idx);
                const topicColor = topicColorMap.get(q.topicId) ?? "bg-slate-500";
                return (
                  <button
                    key={q.id}
                    onClick={() => navigateTo(idx)}
                    disabled={isGrading}
                    aria-label={`Question ${idx + 1} — ${status}`}
                    className={cn(
                      "relative flex-shrink-0 w-8 h-8 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                      status === "current" &&
                        "bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-500 shadow-md shadow-cyan-500/25",
                      status === "correct" &&
                        "bg-green-500/15 text-green-400 border border-green-500/30",
                      status === "wrong" &&
                        "bg-red-500/15 text-red-400 border border-red-500/30",
                      status === "skipped" &&
                        "bg-amber-500/10 text-amber-400 border border-amber-500/30",
                      status === "unanswered" &&
                        "bg-slate-800/40 text-slate-500 border border-slate-700/40 hover:border-slate-500 hover:text-slate-300 hover:bg-slate-800/60"
                    )}
                  >
                    {/* Topic color pip */}
                    {status === "unanswered" && (
                      <span
                        className={cn(
                          "absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full",
                          topicColor
                        )}
                        style={{ opacity: 0.7 }}
                      />
                    )}
                    {status === "correct" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : status === "wrong" ? (
                      <X className="w-3.5 h-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              onClick={handleFinishClick}
              disabled={isGrading}
              size="sm"
              className={cn(
                "flex-shrink-0 gap-1.5 text-xs font-bold transition-all duration-150 rounded-lg",
                unansweredCount === 0
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              )}
            >
              <Flag className="w-3.5 h-3.5" />
              {unansweredCount === 0 ? <>Finish</> : <>{unansweredCount} left</>}
            </Button>
          </div>
        </div>
      </div>

      {/* ===== Finish confirmation ===== */}
      <AnimatePresence>
        {showFinishConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rpg-card rounded-xl p-4 border-2 border-amber-500/30 bg-amber-500/5">
              <p className="text-sm text-amber-200 mb-3">
                You have{" "}
                <strong className="text-amber-400">{unansweredCount} unanswered</strong>{" "}
                question{unansweredCount !== 1 ? "s" : ""}. Unanswered questions will be
                scored as 0. Continue?
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFinishConfirm(false)}
                  className="border-slate-700/50 text-slate-300 hover:bg-white/5"
                >
                  Go Back
                </Button>
                <Button
                  size="sm"
                  onClick={completeSession}
                  disabled={isGrading}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium gap-1.5"
                >
                  {isGrading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Flag className="w-3.5 h-3.5" />
                      Finish Anyway
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Question card ===== */}
      <AnimatePresence mode="wait" custom={navDirection}>
        <motion.div
          key={currentIdx}
          custom={navDirection}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <div
            className="rpg-card rounded-2xl p-5 sm:p-8 space-y-5 sm:space-y-6"
            dir={rtl ? "rtl" : "ltr"}
          >
            {/* Type badge + difficulty */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full border",
                    currentQuestion.type === "mcq"
                      ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                      : "bg-violet-500/10 border-violet-500/20 text-violet-400"
                  )}
                >
                  {currentQuestion.type === "mcq" ? "Multiple Choice" : "Open Question"}
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  Q{currentIdx + 1}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                {difficultyStars.map((filled, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full",
                      filled ? "bg-cyan-400/70" : "bg-slate-700"
                    )}
                  />
                ))}
              </div>
            </div>

            <MarkdownContent className="text-white text-base sm:text-lg font-semibold">
              {currentQuestion.content}
            </MarkdownContent>

            {/* MCQ */}
            {currentQuestion.type === "mcq" && currentQuestion.options && (
              <div className="space-y-2.5">
                {currentQuestion.options.map((option) => {
                  let optionState: "default" | "selected" | "correct" | "wrong" = "default";
                  if (isAnswered) {
                    if (option === currentQuestion.correct_answer) optionState = "correct";
                    else if (
                      option === curState.selectedOption &&
                      option !== currentQuestion.correct_answer
                    )
                      optionState = "wrong";
                  } else if (option === curState.selectedOption) {
                    optionState = "selected";
                  }

                  return (
                    <button
                      key={option}
                      disabled={isAnswered}
                      onClick={() => updateQState(currentQuestion.id, { selectedOption: option })}
                      className={cn(
                        "w-full px-4 py-3 sm:px-5 sm:py-4 rounded-xl border transition-all duration-200 text-sm",
                        rtl ? "text-right" : "text-left",
                        optionState === "default" &&
                          "border-slate-700/50 bg-slate-800/30 text-slate-300 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-white",
                        optionState === "selected" &&
                          "border-cyan-500/60 bg-cyan-600/15 text-white shadow-lg shadow-cyan-500/10",
                        optionState === "correct" &&
                          "border-green-500/60 bg-green-500/10 text-green-300 glow-green",
                        optionState === "wrong" &&
                          "border-red-500/60 bg-red-500/10 text-red-300 glow-red",
                        isAnswered && optionState === "default" && "opacity-40"
                      )}
                    >
                      <span className={cn("font-mono text-xs opacity-50 shrink-0", rtl ? "ml-3" : "mr-3")}>
                        {option.split(".")[0]}.
                      </span>
                      <MarkdownInline className="flex-1">{option.replace(/^[A-D]\.\s*/, "")}</MarkdownInline>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Open answer */}
            {currentQuestion.type === "open" && (
              <div className="space-y-2">
                <Textarea
                  dir="auto"
                  value={curState.openAnswer}
                  onChange={(e) =>
                    updateQState(currentQuestion.id, { openAnswer: e.target.value })
                  }
                  disabled={isAnswered}
                  placeholder="Write your answer here..."
                  className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500/50 min-h-[120px] resize-none"
                />
                {!isAnswered && (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <AnswerImagePicker
                      image={curState.openAnswerImage}
                      onChange={(file) =>
                        updateQState(currentQuestion.id, { openAnswerImage: file })
                      }
                      disabled={isGrading}
                      dir={rtl ? "rtl" : "ltr"}
                    />
                    <p className="text-xs text-slate-600">
                      Explain your understanding in your own words.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Feedback */}
            {isAnswered && curState.result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-xl p-5 space-y-3 border",
                  isCorrect
                    ? "bg-green-500/10 border-green-500/20"
                    : "bg-red-500/10 border-red-500/20"
                )}
              >
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      "font-bold text-sm",
                      isCorrect ? "text-green-300" : "text-red-300"
                    )}
                  >
                    {currentQuestion.type === "mcq"
                      ? isCorrect
                        ? "Correct!"
                        : "Not quite right"
                      : `Score: ${Math.round(curState.result.score * 100)}%`}
                  </span>
                </div>
                <MarkdownContent className="text-sm text-slate-300">
                  {curState.result.feedback}
                </MarkdownContent>
                {!isCorrect && (
                  <div className="pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">
                      Correct answer
                    </p>
                    <MarkdownContent className="text-sm text-white">
                      {curState.result.correct_answer}
                    </MarkdownContent>
                    {curState.result.explanation && (
                      <MarkdownContent className="text-xs text-slate-400 italic mt-2">
                        {curState.result.explanation}
                      </MarkdownContent>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentIdx === 0 || isGrading}
                className={cn(
                  "border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/5 gap-1.5 transition-all duration-200",
                  currentIdx === 0 && "invisible"
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Prev
              </Button>

              <div className="flex-1 flex justify-center">
                {!isAnswered && (
                  <Button
                    onClick={submitAnswer}
                    disabled={
                      isGrading ||
                      (currentQuestion.type === "mcq"
                        ? !curState.selectedOption
                        : curState.openAnswer.trim().length < 5)
                    }
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium px-8 gap-2 transition-all duration-150"
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Grading...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4" />
                        Submit Answer
                      </>
                    )}
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                onClick={goNext}
                disabled={currentIdx >= questions.length - 1 || isGrading}
                className={cn(
                  "border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/5 gap-1.5 transition-all duration-200",
                  currentIdx >= questions.length - 1 && "invisible"
                )}
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Public export — wraps XPBurstProvider ────────────────────────────────────

export default function ReviewEngine(props: ReviewEngineProps) {
  return (
    <XPBurstProvider>
      <ReviewEngineInner {...props} />
    </XPBurstProvider>
  );
}
