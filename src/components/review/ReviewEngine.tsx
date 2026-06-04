"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  HelpCircle,
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
import ConfidenceRow, { type Confidence } from "@/components/quiz/ConfidenceRow";
import ClarifierThread from "@/components/quiz/ClarifierThread";
import LuckyGuessExplanation from "@/components/quiz/LuckyGuessExplanation";
import RegenerateQuestionButton, {
  type RegeneratedQuestion,
} from "@/components/quiz/RegenerateQuestionButton";
import { readClassifiedErrorFromResponse, classifyAiError } from "@/lib/ai-error";
import { showFreezeToasts } from "@/lib/freeze-toast";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  clearSessionDrafts,
} from "@/lib/answer-draft";
import { INLINE_COPY } from "@/lib/loading-copy";

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
  /** Phase 2: student's self-rated confidence (set after grading). */
  confidence: Confidence | null;
  /** review_answers.id from the grade response — keys the confidence PATCH
   *  and the clarifier thread. Null until graded. */
  answerId: string | null;
  /** Slice 3: whether the wrong-answer clarifier thread is open. Stored
   *  per-question so an open clarifier survives navigating away + back. */
  clarifierOpen: boolean;
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
  /** Session-wide confidence chip (A2 Slice 2). Null when no confident/
   *  guessed answer across the whole session moved the SR signal. */
  confidenceEffect?: {
    kind: "overconfident-stumble" | "confident-mastery" | "lucky-win";
    line: string;
  } | null;
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
  questions: initialQuestions,
  userStreak,
}: ReviewEngineProps) {
  const { fireBurst } = useXPBurst();
  const router = useRouter();
  const { play: playSfx } = useSound();

  // Local copy so the regenerate button can swap a question in place
  // without remounting the engine.
  const [questions, setQuestions] = useState(initialQuestions);

  const [questionStates, setQuestionStates] = useState<Map<string, QuestionState>>(() => {
    const map = new Map<string, QuestionState>();
    initialQuestions.forEach((q, i) => {
      map.set(q.id, {
        selectedOption: null,
        openAnswer: "",
        openAnswerImage: null,
        result: null,
        confidence: null,
        answerId: null,
        clarifierOpen: false,
        visited: i === 0,
        skipped: false,
      });
    });
    return map;
  });

  // Swap a regenerated question into local state. The server has already
  // soft-replaced the old row; the engine keeps running without remount.
  const handleRegenerated = useCallback(
    (oldQuestion: ReviewQuestion, newQuestion: RegeneratedQuestion) => {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === oldQuestion.id
            ? {
                ...q, // keep topicId + topicTitle (review sessions interleave topics)
                id: newQuestion.id,
                type: newQuestion.type,
                content: newQuestion.content,
                options: newQuestion.options,
                correct_answer: newQuestion.correct_answer,
                explanation: newQuestion.explanation,
                difficulty: newQuestion.difficulty,
              }
            : q
        )
      );
      setQuestionStates((prev) => {
        const next = new Map(prev);
        next.delete(oldQuestion.id);
        next.set(newQuestion.id, {
          selectedOption: null,
          openAnswer: "",
          openAnswerImage: null,
          result: null,
          confidence: null,
          answerId: null,
          clarifierOpen: false,
          visited: true,
          skipped: false,
        });
        return next;
      });
      clearDraft(sessionId, oldQuestion.id);
    },
    [sessionId]
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isGrading, setIsGrading] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Leave-review confirmation banner state — non-destructive abandon
  // (answers stay saved; session can be resumed by URL).
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [completeData, setCompleteData] = useState<CompleteData | null>(null);

  // ─── Navigator scroll behavior ───
  // Auto-scroll the current dot into the visible area when it changes.
  // Hoisted above early returns (rules-of-hooks); see completeData branch.
  useEffect(() => {
    const btn = dotRefs.current[currentIdx];
    if (btn) {
      btn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIdx]);

  // Manual chevron scroll (left / right) for click-to-scroll discovery.
  // Hoisted above early returns (rules-of-hooks).
  const scrollNavBy = useCallback((direction: 1 | -1) => {
    const el = navScrollRef.current;
    if (!el) return;
    const amount = Math.max(140, Math.round(el.clientWidth * 0.7));
    el.scrollBy({ left: amount * direction, behavior: "smooth" });
  }, []);

  // Handle Leave-Review confirm → back to the review landing.
  // Hoisted above early returns (rules-of-hooks).
  const handleLeaveConfirm = useCallback(() => {
    router.push(`/dashboard/review`);
  }, [router]);

  const currentQuestion = questions[currentIdx];

  const getQState = useCallback(
    (qId: string): QuestionState =>
      questionStates.get(qId) ?? {
        selectedOption: null,
        openAnswer: "",
        openAnswerImage: null,
        result: null,
        confidence: null,
        answerId: null,
        clarifierOpen: false,
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
        confidence: null,
        answerId: null,
        clarifierOpen: false,
        visited: false,
        skipped: false,
      };
      next.set(qId, { ...current, ...patch });
      return next;
    });
  }, []);

  // ── Answer-draft persistence ────────────────────────────────────────────────
  // Restore drafted open-answer text on mount so a mid-review failure
  // (Claude 429 / overload / network drop) preserves typed work.
  const draftsRestoredRef = useRef(false);
  useEffect(() => {
    if (draftsRestoredRef.current) return;
    draftsRestoredRef.current = true;
    let restoredAny = false;
    for (const q of questions) {
      if (q.type === "mcq") continue;
      const draft = loadDraft(sessionId, q.id);
      if (draft) {
        updateQState(q.id, { openAnswer: draft });
        restoredAny = true;
      }
    }
    if (restoredAny) {
      toast.success("Restored your saved answer.", { duration: 2500 });
    }
  }, [questions, sessionId, updateQState]);

  // Debounced save on every keystroke for the current open-answer.
  const currentQuestionIdForDraft = questions[currentIdx]?.id;
  const currentQuestionTypeForDraft = questions[currentIdx]?.type;
  const currentOpenAnswerText = currentQuestionIdForDraft
    ? questionStates.get(currentQuestionIdForDraft)?.openAnswer ?? ""
    : "";
  useEffect(() => {
    if (!currentQuestionIdForDraft || currentQuestionTypeForDraft === "mcq") return;
    const timer = setTimeout(() => {
      saveDraft(sessionId, currentQuestionIdForDraft, currentOpenAnswerText);
    }, 600);
    return () => clearTimeout(timer);
  }, [
    sessionId,
    currentQuestionIdForDraft,
    currentQuestionTypeForDraft,
    currentOpenAnswerText,
  ]);

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

      if (!res.ok) {
        // Classified upstream failure — keep the typed answer (already
        // persisted via the debounced save) and surface an actionable line.
        const classified = await readClassifiedErrorFromResponse(res);
        toast.error(classified.userMessage, { duration: 6000 });
        return;
      }
      const { score, feedback, answerId } = await res.json();

      // Grade succeeded — answer is in the DB, drop the local draft.
      clearDraft(sessionId, currentQuestion.id);

      updateQState(currentQuestion.id, {
        result: {
          score,
          feedback,
          correct_answer: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation,
        },
        answerId: answerId ?? null,
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
      const classified = classifyAiError(err);
      toast.error(classified.userMessage, { duration: 6000 });
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

      // Freeze-token toasts (migration 021) — burn / earn.
      showFreezeToasts(data);

      // Review locked server-side — drop all per-question drafts.
      clearSessionDrafts(sessionId);

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
        confidenceEffect={completeData.confidenceEffect}
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
            <div className="flex items-center gap-2 min-w-0">
              <Brain className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span className="font-pixel text-[9px] text-cyan-400 uppercase tracking-widest">
                Training Mode
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-bold text-slate-400 tabular-nums">
                <span className={cn(
                  answeredCount === questions.length ? "text-green-400" : "text-cyan-400"
                )}>{answeredCount}</span>
                <span className="text-slate-600 mx-0.5">/</span>
                {questions.length}
              </span>
              {/* Leave Review — opens the confirmation banner below. Non-
                  destructive: answers stay saved, session preserved. */}
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                aria-label="Leave review"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-white/[0.07] hover:border-red-500/30 rounded-lg px-2.5 py-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                Leave
              </button>
            </div>
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

          {/* Question dots + chevron scroll buttons + finish button */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollNavBy(-1)}
              aria-label="Scroll question list left"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={navScrollRef}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2 px-1 flex-1 min-w-0 scroll-smooth"
            >
              {questions.map((q, idx) => {
                const status = getDotStatus(idx);
                const topicColor = topicColorMap.get(q.topicId) ?? "bg-slate-500";
                return (
                  <button
                    key={q.id}
                    ref={(el) => { dotRefs.current[idx] = el; }}
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

            <button
              type="button"
              onClick={() => scrollNavBy(1)}
              aria-label="Scroll question list right"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <Button
              onClick={handleFinishClick}
              disabled={isGrading}
              size="sm"
              className={cn(
                "flex-shrink-0 gap-1.5 text-xs font-bold transition-all duration-150 rounded-lg ml-1",
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

      {/* ===== Leave Confirmation Banner ===== */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rpg-card rounded-xl p-4 border-2 border-red-500/30 bg-red-500/[0.04]">
              <p className="text-sm text-slate-300 mb-3">
                Leave this review session? Your answers are{" "}
                <strong className="text-white">saved automatically</strong> —
                pick it back up from the review page later.
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="border-white/[0.08] text-slate-300 hover:bg-white/[0.04] hover:text-white"
                >
                  Stay
                </Button>
                <Button
                  size="sm"
                  onClick={handleLeaveConfirm}
                  className="bg-red-500/90 hover:bg-red-500 text-white gap-1.5"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  Leave Review
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                      {INLINE_COPY.reviewFinish}
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
            {/* Type badge + difficulty + regenerate */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full border whitespace-nowrap",
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
              <div className="flex items-center gap-3 flex-shrink-0">
                {!isAnswered && (
                  <RegenerateQuestionButton
                    questionId={currentQuestion.id}
                    variant="inline"
                    disabled={isGrading}
                    onRegenerated={(nq) => handleRegenerated(currentQuestion, nq)}
                  />
                )}
                <div className="flex items-center gap-0.5" aria-label="Question difficulty">
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

                  // Letter prefix in its own tile + body in MarkdownInline.
                  // Button is flex + rtl:flex-row-reverse — without that
                  // bidi merges "C." with a leading Latin acronym in the
                  // body (e.g. "NFA"/"DFA"), rendering them glued together.
                  const letterMatch = option.match(/^([A-D])\.\s*/);
                  const letter = letterMatch ? letterMatch[1] : option[0];
                  const body = letterMatch ? option.slice(letterMatch[0].length) : option;
                  return (
                    <button
                      key={option}
                      disabled={isAnswered}
                      onClick={() => updateQState(currentQuestion.id, { selectedOption: option })}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 rounded-xl border transition-all duration-200 text-sm",
                        rtl ? "flex-row-reverse text-right" : "text-left",
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
                      <span
                        className={cn(
                          "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors duration-200",
                          optionState === "default" && "bg-white/[0.05] text-slate-400",
                          optionState === "selected" && "bg-cyan-500/30 text-cyan-300",
                          optionState === "correct" && "bg-green-500/30 text-green-300",
                          optionState === "wrong" && "bg-red-500/30 text-red-300"
                        )}
                      >
                        {letter}
                      </span>
                      <MarkdownInline className="flex-1">{body}</MarkdownInline>
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

                {/* ── Phase 2: confidence row + wrong-answer clarifier ──
                     Both appear once the answer is graded AND we have an
                     answerId (the PATCH + clarifier endpoints key off it).
                     ConfidenceRow is always visible; the clarifier button
                     only shows on wrong / partial answers (score < 0.7).
                     The self-report folds into this topic's SM-2 schedule at
                     /complete (per ADR-0001). Indigo Loremaster chrome is
                     kept intact even on Review's cyan surface. The
                     lucky-guess clarifier (right answer rated "guessed")
                     lands in a later slice. */}
                {curState.answerId && (
                  <>
                    <ConfidenceRow
                      value={curState.confidence}
                      dir={rtl ? "rtl" : "ltr"}
                      onChange={(next: Confidence) => {
                        updateQState(currentQuestion.id, { confidence: next });
                        // Fire-and-forget. Silent on failure — the user already
                        // has the grade; confidence isn't critical-path.
                        fetch(
                          `/api/review/answers/${curState.answerId}/confidence`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ confidence: next }),
                          },
                        ).catch((err) =>
                          console.warn("[ReviewEngine] confidence PATCH failed:", err),
                        );
                      }}
                    />

                    {curState.result.score < 0.7 && !curState.clarifierOpen && (
                      <button
                        type="button"
                        onClick={() =>
                          updateQState(currentQuestion.id, { clarifierOpen: true })
                        }
                        className="mt-3 inline-flex items-center gap-1.5 pixel-chip px-3 py-1.5 font-pixel text-[9px] tracking-wider text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/10"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        HELP ME UNDERSTAND →
                      </button>
                    )}

                    {curState.result.score < 0.7 && curState.clarifierOpen && (
                      <ClarifierThread
                        answerKind="review"
                        answerId={curState.answerId}
                        dir={rtl ? "rtl" : "ltr"}
                        onClose={() =>
                          updateQState(currentQuestion.id, { clarifierOpen: false })
                        }
                      />
                    )}

                    {/* Lucky-guess explanation (Slice 4): right answer the
                        learner rated "guessed" → single-shot Loremaster take.
                        Mirrors the Quiz path; the clarifier endpoint's
                        lucky-guess guard reads confidence off the review
                        answer row, so follow-up turns are refused server-side. */}
                    {curState.result.score >= 0.7 &&
                      curState.confidence === "guessed" && (
                        <LuckyGuessExplanation
                          answerKind="review"
                          answerId={curState.answerId}
                          dir={rtl ? "rtl" : "ltr"}
                        />
                      )}
                  </>
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
                        : // Open answer is submittable when EITHER ≥5 chars
                          // typed OR a diagram image attached.
                          curState.openAnswer.trim().length < 5 &&
                          !curState.openAnswerImage)
                    }
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium px-8 gap-2 transition-all duration-150"
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {INLINE_COPY.reviewGrade}
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
