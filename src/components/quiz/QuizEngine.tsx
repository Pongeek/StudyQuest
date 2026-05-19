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
  Swords,
  Check,
  X,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import SessionDebrief from "./SessionDebrief";
import MarkdownContent from "./MarkdownContent";
import MarkdownInline from "./MarkdownInline";
import { XPBurstProvider, useXPBurst } from "@/components/effects/XPBurst";
import ComboHUD from "@/components/effects/ComboHUD";
import { useSound } from "@/lib/useSound";
import LevelUpOverlay from "@/components/effects/LevelUpOverlay";
import AchievementUnlockOverlay, {
  type UnlockedAchievement,
} from "@/components/effects/AchievementUnlockOverlay";
import GradingOverlay from "@/components/effects/GradingOverlay";
import { calculateLevel, getLevelTitle, XP_REWARDS } from "@/lib/xp";

function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

interface Question {
  id: string;
  type: "mcq" | "open";
  content: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  difficulty: number;
}

interface AnswerResult {
  questionId: string;
  question: string;
  userAnswer: string;
  score: number;
  feedback: string;
  type: "mcq" | "open";
}

/** Stored state for each question slot */
interface QuestionState {
  selectedOption: string | null;
  openAnswer: string;
  result: {
    score: number;
    feedback: string;
    correct_answer: string;
    explanation: string;
  } | null;
  /** True once the user has visited (navigated to) this question */
  visited: boolean;
  /** True if the user navigated past without answering */
  skipped: boolean;
}

// Phase state machine for post-completion flow
type CompletionPhase =
  | "playing"
  | "summary-pending"
  | "level-up"
  | "achievements"
  | "debrief";

interface QuizEngineProps {
  sessionId: string;
  topicId: string;
  courseId: string;
  questions: Question[];
  topicTitle: string;
  topicSummary: string;
  episodeTitle: string;
  userStreak: number;
  /** User's total XP before this session — used for level-up detection */
  userTotalXp: number;
}

// ─── Inner engine (consumes XPBurstProvider) ──────────────────────────────────

function QuizEngineInner({
  sessionId,
  topicId,
  courseId,
  questions,
  topicTitle,
  episodeTitle,
  userStreak,
  userTotalXp,
}: QuizEngineProps) {
  const { fireBurst } = useXPBurst();
  const router = useRouter();
  const { play: playSfx } = useSound();

  // --- Per-question state map ---
  const [questionStates, setQuestionStates] = useState<Map<string, QuestionState>>(() => {
    const map = new Map<string, QuestionState>();
    questions.forEach((q, i) => {
      map.set(q.id, {
        selectedOption: null,
        openAnswer: "",
        result: null,
        visited: i === 0,
        skipped: false,
      });
    });
    return map;
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isGrading, setIsGrading] = useState(false);
  // Separate from `isGrading` (per-question loader) — drives the full-screen
  // GradingOverlay shown only during session-completion AI work (5-15s wait).
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Combo tracking
  const [combo, setCombo] = useState(0);
  const maxComboRef = useRef(0);

  // Session summary + phase state machine
  const [sessionSummary, setSessionSummary] = useState<{
    xpEarned: number;
    scorePct: number;
    debrief: { strengths: string[]; gaps: string[]; next_topic: string; reason: string } | null;
    masteryEvolution: { topicId: string; fromLevel: number; toLevel: number } | null;
  } | null>(null);
  const [completionPhase, setCompletionPhase] = useState<CompletionPhase>("playing");

  // Level-up state
  const [levelUpInfo, setLevelUpInfo] = useState<{
    fromLevel: number;
    toLevel: number;
    newRank?: string;
  } | null>(null);

  // Achievement overlay state
  const [pendingAchievements, setPendingAchievements] = useState<UnlockedAchievement[]>([]);

  // Direction of navigation for animation
  const [navDirection, setNavDirection] = useState<1 | -1>(1);

  // Ref for scrollable navigator
  const navScrollRef = useRef<HTMLDivElement>(null);

  const currentQuestion = questions[currentIdx];

  // Helpers to read/write per-question state
  const getQState = useCallback(
    (qId: string): QuestionState =>
      questionStates.get(qId) ?? {
        selectedOption: null,
        openAnswer: "",
        result: null,
        visited: false,
        skipped: false,
      },
    [questionStates]
  );

  const updateQState = useCallback(
    (qId: string, patch: Partial<QuestionState>) => {
      setQuestionStates((prev) => {
        const next = new Map(prev);
        const current = next.get(qId) ?? {
          selectedOption: null,
          openAnswer: "",
          result: null,
          visited: false,
          skipped: false,
        };
        next.set(qId, { ...current, ...patch });
        return next;
      });
    },
    []
  );

  // Derived counts
  const answeredCount = useMemo(
    () => Array.from(questionStates.values()).filter((s) => s.result !== null).length,
    [questionStates]
  );

  const unansweredCount = questions.length - answeredCount;

  // Collect results array from state
  const buildResultsArray = useCallback((): AnswerResult[] => {
    return questions.map((q) => {
      const state = getQState(q.id);
      if (!state.result) {
        return {
          questionId: q.id,
          question: q.content,
          userAnswer: "",
          score: 0,
          feedback: "Unanswered",
          type: q.type,
        };
      }
      return {
        questionId: q.id,
        question: q.content,
        userAnswer:
          q.type === "mcq" ? state.selectedOption ?? "" : state.openAnswer,
        score: state.result.score,
        feedback: state.result.feedback,
        type: q.type,
      };
    });
  }, [questions, getQState]);

  // --- Navigation ---
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

  // --- Submit (grade) current question ---
  const submitAnswer = async () => {
    if (!currentQuestion) return;

    const qState = getQState(currentQuestion.id);
    const userAnswer =
      currentQuestion.type === "mcq"
        ? qState.selectedOption ?? ""
        : qState.openAnswer.trim();

    if (!userAnswer) {
      toast.error("Please provide an answer before submitting.");
      return;
    }

    setIsGrading(true);
    try {
      const res = await fetch("/api/quiz/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          userAnswer,
          topicTitle,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Grade failed (${res.status}): ${body || res.statusText}`);
      }
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

      const correct = score >= 0.7;

      // Update combo
      if (correct) {
        const newCombo = combo + 1;
        setCombo(newCombo);
        if (newCombo > maxComboRef.current) maxComboRef.current = newCombo;

        // Fire XP burst — estimate using XP_REWARDS for immediate feedback
        // TODO: wire combo bonus into server XP calculation
        const estimatedXp =
          currentQuestion.type === "mcq"
            ? XP_REWARDS.mcq_correct
            : score >= 0.9
            ? XP_REWARDS.open_excellent
            : XP_REWARDS.open_good;

        fireBurst({
          amount: estimatedXp,
          combo: newCombo >= 2 ? newCombo : undefined,
        });

        // Audio: correct chime + tiered XP ping. Combo escalation when chaining.
        playSfx("correct");
        const xpTier: "normal" | "big" | "critical" =
          estimatedXp >= 61 ? "critical" : estimatedXp >= 21 ? "big" : "normal";
        playSfx("xp", xpTier);
        if (newCombo >= 2) playSfx("combo", newCombo);
      } else {
        setCombo(0);
        playSfx("wrong");
      }
    } catch (err) {
      console.error("[QuizEngine] answer grading failed:", err);
      toast.error("Failed to grade your answer. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  // --- Phase-advance helpers ---
  const advancePhase = useCallback(
    (
      xpEarned: number,
      newAchievements: UnlockedAchievement[],
    ) => {
      const prevLevel = calculateLevel(userTotalXp);
      const newLevel = calculateLevel(userTotalXp + xpEarned);
      const leveledUp = newLevel > prevLevel;

      if (leveledUp) {
        const prevRank = getLevelTitle(prevLevel);
        const newRank = getLevelTitle(newLevel);
        setLevelUpInfo({
          fromLevel: prevLevel,
          toLevel: newLevel,
          newRank: prevRank !== newRank ? newRank : undefined,
        });
        setPendingAchievements(newAchievements);
        setCompletionPhase("level-up");
      } else if (newAchievements.length > 0) {
        setPendingAchievements(newAchievements);
        setCompletionPhase("achievements");
      } else {
        setCompletionPhase("debrief");
      }
    },
    [userTotalXp]
  );

  const handleLevelUpClose = useCallback(() => {
    if (pendingAchievements.length > 0) {
      setCompletionPhase("achievements");
    } else {
      setCompletionPhase("debrief");
    }
  }, [pendingAchievements.length]);

  const handleAchievementsDismissed = useCallback(() => {
    setCompletionPhase("debrief");
  }, []);

  // --- Complete session ---
  const completeSession = async () => {
    setIsGrading(true);
    setIsFinalizing(true);
    setShowFinishConfirm(false);
    try {
      const results = buildResultsArray();
      const res = await fetch(`/api/quiz/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: results,
          topicId,
          streakDays: userStreak,
          maxCombo: maxComboRef.current,
        }),
      });

      if (!res.ok) throw new Error("Failed to complete session");
      const data = await res.json();

      setSessionSummary({
        xpEarned: data.xpEarned,
        scorePct: data.scorePct,
        debrief: data.debrief,
        masteryEvolution: data.masteryEvolution ?? null,
      });
      setCompletionPhase("summary-pending");

      const newAchievements: UnlockedAchievement[] = data.newAchievements ?? [];
      advancePhase(data.xpEarned, newAchievements);

      // NOTE: Do NOT call `router.refresh()` here. The quiz session page
      // does `redirect(...)` when `session.completed_at` is set — if we
      // refresh the server route now, the user gets bounced off the
      // debrief screen. Refresh is fired by the debrief's nav buttons
      // (passed in via `onNavigate` below) so the layout is fresh only
      // once the user actually leaves the engine.
    } catch {
      toast.error("Failed to save your results.");
    } finally {
      setIsGrading(false);
      setIsFinalizing(false);
    }
  };

  const handleFinishClick = () => {
    if (unansweredCount > 0) {
      setShowFinishConfirm(true);
    } else {
      completeSession();
    }
  };

  // --- Debrief screen ---
  if (completionPhase === "debrief" && sessionSummary) {
    return (
      <SessionDebrief
        xpEarned={sessionSummary.xpEarned}
        scorePct={sessionSummary.scorePct}
        debrief={sessionSummary.debrief}
        topicTitle={topicTitle}
        courseId={courseId}
        topicId={topicId}
        masteryEvolution={sessionSummary.masteryEvolution}
        results={buildResultsArray()}
      />
    );
  }

  if (!currentQuestion) return null;

  const curState = getQState(currentQuestion.id);
  const isAnswered = curState.result !== null;
  const isCorrect = isAnswered && curState.result!.score >= 0.7;
  const rtl = isRTL(currentQuestion.content);
  const difficultyStars = Array.from({ length: 5 }, (_, i) => i < currentQuestion.difficulty);

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
    <>
      {/* Combo HUD — rendered at engine TOP LEVEL, outside any animated
          parent. CSS transforms on ancestors create a new containing block
          for `position: fixed`, so the chip would otherwise drift along
          with the question card's slide animation during prev/next nav. */}
      <ComboHUD count={combo} />

      {/* Grading overlay — full-screen sigil + cycling status messages
          shown while Claude grades open answers + generates the debrief.
          Renders ABOVE the quiz UI but BELOW LevelUpOverlay (z-[150]) and
          AchievementUnlockOverlay (z-[160]) so those celebrations can
          appear on top once grading finishes. */}
      <GradingOverlay show={isFinalizing} kind="quiz" />

      {/* Level-up overlay */}
      {levelUpInfo && (
        <LevelUpOverlay
          show={completionPhase === "level-up"}
          fromLevel={levelUpInfo.fromLevel}
          toLevel={levelUpInfo.toLevel}
          newRank={levelUpInfo.newRank}
          onClose={handleLevelUpClose}
        />
      )}

      {/* Achievement overlay */}
      {completionPhase === "achievements" && pendingAchievements.length > 0 && (
        <AchievementUnlockOverlay
          achievements={pendingAchievements}
          onAllDismissed={handleAchievementsDismissed}
        />
      )}

      <div className="max-w-2xl mx-auto space-y-4">
        {/* ===== Question Navigator Bar ===== */}
        <div className="rpg-card rounded-2xl overflow-hidden">
          <div className="w-full h-1.5 bg-white/[0.06]">
            <motion.div
              className={cn(
                "h-full rounded-r-full",
                answeredCount === questions.length ? "bg-emerald-500" : "bg-indigo-500"
              )}
              animate={{ width: `${(answeredCount / questions.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-slate-400 font-medium truncate">{topicTitle}</span>
              </div>
              <span className="text-sm font-bold text-slate-400 tabular-nums flex-shrink-0">
                <span className={cn(
                  answeredCount === questions.length ? "text-green-400" : "text-indigo-400"
                )}>{answeredCount}</span>
                <span className="text-slate-600 mx-0.5">/</span>
                {questions.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div
                ref={navScrollRef}
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2 px-1 flex-1 min-w-0"
              >
                {questions.map((q, idx) => {
                  const status = getDotStatus(idx);
                  return (
                    <button
                      key={q.id}
                      onClick={() => navigateTo(idx)}
                      disabled={isGrading}
                      aria-label={`Question ${idx + 1} — ${status}`}
                      className={cn(
                        "relative flex-shrink-0 w-8 h-8 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                        status === "current" &&
                          "bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500 shadow-md shadow-indigo-500/25",
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
                    : "bg-indigo-500 hover:bg-indigo-400 text-white"
                )}
              >
                <Flag className="w-3.5 h-3.5" />
                {unansweredCount === 0 ? <>Finish</> : <>{unansweredCount} left</>}
              </Button>
            </div>
          </div>
        </div>

        {/* ===== Finish Confirmation Dialog ===== */}
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

        {/* ===== Question Card ===== */}
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
              {/* Question type badge + difficulty */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-bold px-3 py-1 rounded-full border",
                      currentQuestion.type === "mcq"
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
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
                        filled ? "bg-amber-400" : "bg-slate-700"
                      )}
                    />
                  ))}
                </div>
              </div>

              <MarkdownContent className="text-white text-base sm:text-lg font-semibold">
                {currentQuestion.content}
              </MarkdownContent>

              {/* MCQ options */}
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
                            "border-slate-700/50 bg-slate-800/30 text-slate-300 hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:text-white hover:shadow-lg hover:shadow-indigo-500/5",
                          optionState === "selected" &&
                            "border-indigo-500/60 bg-indigo-600/15 text-white shadow-lg shadow-indigo-500/10",
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

              {/* Open question textarea */}
              {currentQuestion.type === "open" && (
                <div className="space-y-2">
                  <Textarea
                    value={curState.openAnswer}
                    onChange={(e) =>
                      updateQState(currentQuestion.id, { openAnswer: e.target.value })
                    }
                    disabled={isAnswered}
                    placeholder="Write your answer here... Explain your understanding in your own words."
                    className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 min-h-[120px] resize-none"
                  />
                  {!isAnswered && (
                    <p className="text-xs text-slate-600">
                      Write a thorough answer -- the AI will grade based on conceptual accuracy.
                    </p>
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

              {/* ===== Action Buttons ===== */}
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
                      className="bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-8 gap-2 transition-all duration-150"
                    >
                      {isGrading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Grading...
                        </>
                      ) : (
                        <>
                          <Swords className="w-4 h-4" />
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
    </>
  );
}

// ─── Public export — wraps provider ──────────────────────────────────────────

export default function QuizEngine(props: QuizEngineProps) {
  return (
    <XPBurstProvider>
      <QuizEngineInner {...props} />
    </XPBurstProvider>
  );
}
