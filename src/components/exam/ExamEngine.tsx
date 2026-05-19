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
  Clock,
  BookOpen,
  Swords,
  Check,
  X,
  Flag,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/quiz/MarkdownContent";
import MarkdownInline from "@/components/quiz/MarkdownInline";
import ExamDebrief from "./ExamDebrief";
import { XPBurstProvider, useXPBurst } from "@/components/effects/XPBurst";
import { useSound } from "@/lib/useSound";
import ComboHUD from "@/components/effects/ComboHUD";
import LevelUpOverlay from "@/components/effects/LevelUpOverlay";
import AchievementUnlockOverlay, {
  type UnlockedAchievement,
} from "@/components/effects/AchievementUnlockOverlay";
import GradingOverlay from "@/components/effects/GradingOverlay";
import { calculateLevel, getLevelTitle, XP_REWARDS } from "@/lib/xp";

function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

export interface ExamQuestion {
  id: string;
  content: string;
  marks: number;
  order_index: number;
  type?: "mcq" | "open";
  options?: string[] | null;
  correct_answer?: string | null;
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

/** Stored state for each exam question slot */
interface QuestionState {
  openAnswer: string;
  selectedOption: string | null;
  result: {
    score: number;
    feedback: string;
    modelAnswer?: string;
  } | null;
  /** True once the user has navigated to this question */
  visited: boolean;
  /** True if the user navigated away without answering */
  skipped: boolean;
}

interface ExamEngineProps {
  examSessionId: string;
  courseId: string;
  questions: ExamQuestion[];
  mode: "timed" | "assisted";
  examTitle: string;
  /** User's total XP before this session — used for level-up detection */
  userTotalXp?: number;
}

// Phase machine for post-completion flow
type CompletionPhase = "playing" | "level-up" | "achievements" | "debrief";

function ExamEngineInner({
  examSessionId,
  courseId,
  questions,
  mode,
  examTitle,
  userTotalXp = 0,
}: ExamEngineProps) {
  const { fireBurst } = useXPBurst();
  const router = useRouter();
  const { play: playSfx } = useSound();
  // --- Per-question state map ---
  const [questionStates, setQuestionStates] = useState<Map<string, QuestionState>>(() => {
    const map = new Map<string, QuestionState>();
    questions.forEach((q, i) => {
      map.set(q.id, {
        openAnswer: "",
        selectedOption: null,
        result: null,
        visited: i === 0,
        skipped: false,
      });
    });
    return map;
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isGrading, setIsGrading] = useState(false);
  // Drives the full-screen GradingOverlay during exam completion (the long
  // AI-grading + debrief generation wait — exams can have 20+ open answers).
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [debriefData, setDebriefData] = useState<{
    predictedScore: number;
    examReadiness: string;
    strongestAreas: string[];
    criticalGaps: string[];
    recommendedTopics: string[];
    summary: string;
    xpEarned: number;
  } | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Combo tracking
  const [combo, setCombo] = useState(0);
  // Highest combo reached this session — silently tracked for the
  // Combo Breaker achievement (5x combo), even though the live combo
  // HUD is hidden during exams.
  const maxComboRef = useRef(0);

  // Navigator: ref to the scrollable dot strip + a ref-array for each dot
  // button so we can auto-scroll the current question into view (handles
  // exams with > ~13 questions where later dots are offscreen).
  const navScrollRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Leave-exam confirmation banner state — abandoning is non-destructive
  // (answers stay saved; user can resume by revisiting the session URL).
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Completion phase state machine
  const [completionPhase, setCompletionPhase] = useState<CompletionPhase>("playing");
  const [levelUpInfo, setLevelUpInfo] = useState<{
    fromLevel: number;
    toLevel: number;
    newRank?: string;
  } | null>(null);
  const [pendingAchievements, setPendingAchievements] = useState<UnlockedAchievement[]>([]);

  // Direction of navigation for slide animation
  const [navDirection, setNavDirection] = useState<1 | -1>(1);

  // Timer (timed mode only)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mode === "timed") {
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [mode]);

  const currentQuestion = questions[currentIdx];
  const totalMarks = useMemo(() => questions.reduce((s, q) => s + q.marks, 0), [questions]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Helpers to read/write per-question state
  const getQState = useCallback(
    (qId: string): QuestionState =>
      questionStates.get(qId) ?? {
        openAnswer: "",
        selectedOption: null,
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
        openAnswer: "",
        selectedOption: null,
        result: null,
        visited: false,
        skipped: false,
      };
      next.set(qId, { ...current, ...patch });
      return next;
    });
  }, []);

  // Derived counts
  const answeredCount = useMemo(
    () => Array.from(questionStates.values()).filter((s) => s.result !== null).length,
    [questionStates]
  );
  const unansweredCount = questions.length - answeredCount;

  // Build results array from per-question state
  const buildResultsArray = useCallback((): AnswerResult[] => {
    return questions.map((q) => {
      const state = getQState(q.id);
      const isMcq = q.type === "mcq" && Array.isArray(q.options) && q.options.length > 0;
      if (!state.result) {
        return {
          questionId: q.id,
          question: q.content,
          userAnswer: "",
          score: 0,
          feedback: "Unanswered",
          modelAnswer: undefined,
          marks: q.marks,
          type: q.type ?? "open",
          options: isMcq ? (q.options as string[]) : undefined,
          correctAnswer: q.correct_answer ?? undefined,
        };
      }
      return {
        questionId: q.id,
        question: q.content,
        userAnswer: isMcq ? (state.selectedOption ?? "") : state.openAnswer,
        score: state.result.score,
        feedback: state.result.feedback,
        modelAnswer: state.result.modelAnswer,
        marks: q.marks,
        type: q.type ?? "open",
        options: isMcq ? (q.options as string[]) : undefined,
        correctAnswer: q.correct_answer ?? undefined,
      };
    });
  }, [questions, getQState]);

  // --- Navigation ---
  const navigateTo = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= questions.length || targetIdx === currentIdx) return;
      if (isGrading) return;

      // Mark current question as skipped if visited and unanswered
      const curQ = questions[currentIdx];
      const curState = getQState(curQ.id);
      if (curState.visited && !curState.result) {
        updateQState(curQ.id, { skipped: true });
      }

      setNavDirection(targetIdx > currentIdx ? 1 : -1);
      setCurrentIdx(targetIdx);

      // Mark target as visited
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
    const curState = getQState(currentQuestion.id);
    const isMcq =
      currentQuestion.type === "mcq" &&
      Array.isArray(currentQuestion.options) &&
      currentQuestion.options.length > 0;

    const userAnswer = isMcq
      ? (curState.selectedOption ?? "")
      : curState.openAnswer.trim();

    if (isMcq && !curState.selectedOption) {
      toast.error("Please select an option before submitting.");
      return;
    }
    if (!isMcq && userAnswer.length < 3) {
      toast.error("Please write an answer before submitting.");
      return;
    }

    setIsGrading(true);
    try {
      const res = await fetch(`/api/exams/${examSessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          userAnswer,
          isMcq,
        }),
      });

      if (!res.ok) throw new Error("Failed to grade answer");
      const data = await res.json();

      updateQState(currentQuestion.id, {
        result: {
          score: data.score,
          feedback: data.feedback,
          modelAnswer: data.modelAnswer,
        },
        skipped: false,
      });

      const correct = data.score >= 0.7;
      // ── Real-exam feel ──
      // The exam is supposed to FEEL like an exam — the student gets ZERO
      // indication of correctness until the final debrief, in BOTH modes
      // (Timed and Untimed Practice). The /answer endpoint still grades
      // so the data is recorded; we just don't surface the result mid-exam.
      // Combo is tracked silently so the final debrief / Combo Breaker
      // achievement check still works, but no XP burst, no chime, no
      // combo HUD escalation during the exam itself.
      if (correct) {
        const newCombo = combo + 1;
        setCombo(newCombo);
        if (newCombo > maxComboRef.current) maxComboRef.current = newCombo;
      } else {
        setCombo(0);
      }
    } catch {
      toast.error("Failed to grade answer. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  // --- Complete exam ---
  const completeExam = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsGrading(true);
    setIsFinalizing(true);
    setShowFinishConfirm(false);
    try {
      const res = await fetch(`/api/exams/${examSessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxCombo: maxComboRef.current }),
      });

      if (!res.ok) throw new Error("Failed to complete exam");
      const data = await res.json();
      setDebriefData(data);

      // NOTE: Do NOT call `router.refresh()` here. The exam page redirects
      // away when `completed_at` is set on the session — refreshing the
      // server route during the debrief would bounce the user. The refresh
      // is fired by the debrief's back-to-* buttons just before navigation.

      // Phase machine: level-up → achievements → debrief
      const xpEarned: number = data.xpEarned ?? 0;
      const prevXp: number = data.previousTotalXp ?? userTotalXp;
      const newAchievements: UnlockedAchievement[] = data.newAchievements ?? [];
      const prevLevel = calculateLevel(prevXp);
      const newLevel = calculateLevel(prevXp + xpEarned);

      if (newLevel > prevLevel) {
        const prevRank = getLevelTitle(prevLevel);
        const toRank = getLevelTitle(newLevel);
        setLevelUpInfo({
          fromLevel: prevLevel,
          toLevel: newLevel,
          newRank: prevRank !== toRank ? toRank : undefined,
        });
        setPendingAchievements(newAchievements);
        setCompletionPhase("level-up");
      } else if (newAchievements.length > 0) {
        setPendingAchievements(newAchievements);
        setCompletionPhase("achievements");
      } else {
        setCompletionPhase("debrief");
      }
    } catch {
      toast.error("Failed to save exam results.");
    } finally {
      setIsGrading(false);
      setIsFinalizing(false);
    }
  };

  const handleFinishClick = () => {
    if (unansweredCount > 0) {
      setShowFinishConfirm(true);
    } else {
      completeExam();
    }
  };

  // Phase callbacks
  const handleLevelUpClose = () => {
    if (pendingAchievements.length > 0) {
      setCompletionPhase("achievements");
    } else {
      setCompletionPhase("debrief");
    }
  };

  const handleAchievementsDismissed = () => {
    setCompletionPhase("debrief");
  };

  // --- Debrief screen ---
  if (completionPhase === "debrief" && debriefData) {
    return (
      <ExamDebrief
        courseId={courseId}
        examTitle={examTitle}
        predictedScore={debriefData.predictedScore}
        examReadiness={debriefData.examReadiness}
        strongestAreas={debriefData.strongestAreas}
        criticalGaps={debriefData.criticalGaps}
        recommendedTopics={debriefData.recommendedTopics}
        summary={debriefData.summary}
        xpEarned={debriefData.xpEarned}
        results={buildResultsArray()}
        elapsedSeconds={elapsedSeconds}
        mode={mode}
      />
    );
  }

  if (!currentQuestion) return null;

  const curState = getQState(currentQuestion.id);
  const isAnswered = curState.result !== null;
  const isCorrect = isAnswered && curState.result!.score >= 0.7;
  const rtl = isRTL(currentQuestion.content);
  const isMcq =
    currentQuestion.type === "mcq" &&
    Array.isArray(currentQuestion.options) &&
    currentQuestion.options.length > 0;

  // Dot status for each question.
  // Exam mode never exposes correctness during the exam — answered
  // questions get a neutral "answered" state. The "correct" / "wrong"
  // states still exist in the union for downstream styling fallback but
  // are never produced by this function.
  const getDotStatus = (
    idx: number
  ): "current" | "correct" | "wrong" | "answered" | "skipped" | "unanswered" => {
    if (idx === currentIdx) return "current";
    const q = questions[idx];
    const s = getQState(q.id);
    if (s.result) return "answered";
    if (s.skipped) return "skipped";
    return "unanswered";
  };

  // Determine submit disabled state
  const submitDisabled =
    isGrading ||
    (isMcq ? !curState.selectedOption : curState.openAnswer.trim().length < 3);

  // Animation variants
  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -40 }),
  };

  // ─── Navigator scroll behavior ───
  // Auto-scroll the current dot into the visible area when it changes.
  // This handles long exams (e.g. 18+ questions) where later dots would
  // otherwise be offscreen with no visual cue that they exist.
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

  // Manual chevron-arrow scroll (left / right) for click-to-scroll
  // discovery on desktop. Scrolls by ~70% of the visible container width.
  const scrollNavBy = useCallback((direction: 1 | -1) => {
    const el = navScrollRef.current;
    if (!el) return;
    const amount = Math.max(140, Math.round(el.clientWidth * 0.7));
    el.scrollBy({ left: amount * direction, behavior: "smooth" });
  }, []);

  // Handle Leave-Exam confirm → go back to the exam landing page. The
  // session row stays as-is (not completed). The user can resume by
  // revisiting the same URL because /api/exams/[id] only redirects when
  // `completed_at` is set.
  const handleLeaveConfirm = useCallback(() => {
    router.push(`/dashboard/courses/${courseId}/exam`);
  }, [router, courseId]);

  return (
    <>
      {/* Combo HUD intentionally not rendered in exam mode — exams should
          feel like the real thing, no live feedback of any kind. The combo
          state is still tracked internally so the Combo Breaker achievement
          can fire at the end if the user hit a 5× streak. */}

      {/* Grading overlay — full-screen sigil shown during the long AI grading
          wait after a user submits the exam (open answers are graded one by
          one and the debrief / predicted-score is composed). */}
      <GradingOverlay show={isFinalizing} kind="exam" />

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
        {/* Progress bar at very top */}
        <div className="w-full h-1.5 bg-white/[0.06]">
          <motion.div
            className={cn(
              "h-full rounded-r-full",
              answeredCount === questions.length ? "bg-emerald-500" : mode === "timed" ? "bg-amber-500" : "bg-indigo-500"
            )}
            animate={{ width: `${(answeredCount / questions.length) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        <div className="p-4 space-y-3">
          {/* Top row: mode badge + title + timer/count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mode === "timed" ? (
                <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(elapsedSeconds)}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 text-xs font-bold">
                  <BookOpen className="w-3.5 h-3.5" />
                  Untimed
                </span>
              )}
              <span className="text-sm text-slate-400 font-medium truncate max-w-[120px]">
                {examTitle}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-bold text-slate-400 tabular-nums">
                <span className={cn(answeredCount === questions.length ? "text-green-400" : "text-indigo-400")}>
                  {answeredCount}
                </span>
                <span className="text-slate-600 mx-0.5">/</span>
                {questions.length}
              </span>
              {/* Leave Exam — opens the confirmation banner below. Non-
                  destructive: the session row is preserved so the user
                  can resume by revisiting the URL later. */}
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                aria-label="Leave exam"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-white/[0.07] hover:border-red-500/30 rounded-lg px-2.5 py-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                Leave
              </button>
            </div>
          </div>

          {/* Dot navigator — horizontally scrollable, with chevron buttons
              for click-to-scroll discovery, plus auto-scroll-into-view on
              the current dot when navigating. */}
          <div className="flex items-center gap-1.5">
            {/* Left chevron */}
            <button
              type="button"
              onClick={() => scrollNavBy(-1)}
              aria-label="Scroll question list left"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={navScrollRef}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2 px-1 flex-1 min-w-0 scroll-smooth"
            >
              {questions.map((q, idx) => {
                const status = getDotStatus(idx);
                return (
                  <button
                    key={q.id}
                    ref={(el) => { dotRefs.current[idx] = el; }}
                    onClick={() => navigateTo(idx)}
                    disabled={isGrading}
                    aria-label={`Question ${idx + 1} — ${status}`}
                    className={cn(
                      "relative flex-shrink-0 w-8 h-8 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                      status === "current" &&
                        "bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500 shadow-md",
                      status === "correct" &&
                        "bg-green-500/15 text-green-400 border border-green-500/30",
                      status === "wrong" &&
                        "bg-red-500/15 text-red-400 border border-red-500/30",
                      // Timed-mode "answered" — neutral indigo fill, no
                      // correctness reveal. Matches the "answer locked" cue.
                      status === "answered" &&
                        "bg-indigo-500/10 text-indigo-300 border border-indigo-500/25",
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
                      // "answered" / "current" / "skipped" / "unanswered" all
                      // just show the question number — no leak of correctness.
                      idx + 1
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right chevron */}
            <button
              type="button"
              onClick={() => scrollNavBy(1)}
              aria-label="Scroll question list right"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Finish button */}
            <Button
              onClick={handleFinishClick}
              disabled={isGrading}
              size="sm"
              className={cn(
                "flex-shrink-0 gap-1.5 text-xs font-bold transition-all duration-150 rounded-lg ml-1",
                unansweredCount === 0
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                  : "bg-indigo-500 hover:bg-indigo-400 text-white"
              )}
            >
              <Flag className="w-3.5 h-3.5" />
              {unansweredCount === 0 ? "Finish Exam" : `Finish (${unansweredCount} left)`}
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
                Leave this exam? Your answers are{" "}
                <strong className="text-white">saved automatically</strong> —
                you can resume from your past sessions at any time.
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
                  Leave Exam
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Finish Confirmation Banner ===== */}
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
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={completeExam}
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
            {/* Header: marks pill + question number + type badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400">
                  {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? "s" : ""}
                </span>
                {isMcq && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
                    Multiple Choice
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-600 font-medium">
                Q{currentIdx + 1} of {questions.length} · {totalMarks} total marks
              </span>
            </div>

            {/* Question content */}
            <MarkdownContent className="text-white text-base sm:text-lg font-semibold">
              {currentQuestion.content}
            </MarkdownContent>

            {/* ===== MCQ Options ===== */}
            {isMcq && (
              <div className="space-y-2.5">
                {(currentQuestion.options as string[]).map((option) => {
                  // Exam mode (both Timed and Untimed Practice) never
                  // reveals correctness mid-exam — the locked option just
                  // stays "selected" until the final debrief. The full
                  // per-question reveal happens on the debrief screen.
                  const isSelected = option === curState.selectedOption;

                  // Extract letter prefix (e.g. "A") and option body text
                  const letterMatch = option.match(/^([A-D])\.\s*/);
                  const letter = letterMatch ? letterMatch[1] : option[0];
                  const body = letterMatch ? option.slice(letterMatch[0].length) : option;

                  return (
                    <button
                      key={option}
                      disabled={isAnswered}
                      onClick={() =>
                        updateQState(currentQuestion.id, { selectedOption: option })
                      }
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 rounded-xl border transition-all duration-200 text-sm",
                        rtl ? "flex-row-reverse text-right" : "text-left",
                        !isSelected &&
                          "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:text-white",
                        isSelected &&
                          "border-indigo-500/60 bg-indigo-600/15 text-white",
                        isAnswered && !isSelected && "opacity-40"
                      )}
                    >
                      {/* Letter tile */}
                      <span
                        className={cn(
                          "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors duration-200",
                          !isSelected && "bg-white/[0.05] text-slate-400",
                          isSelected && "bg-indigo-500/30 text-indigo-300"
                        )}
                      >
                        {letter}
                      </span>
                      {/* Option text — rendered with math support */}
                      <MarkdownInline className="flex-1">{body}</MarkdownInline>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ===== Open answer textarea ===== */}
            {!isMcq && (
              <div className="space-y-2">
                <Textarea
                  dir="auto"
                  value={curState.openAnswer}
                  onChange={(e) =>
                    updateQState(currentQuestion.id, { openAnswer: e.target.value })
                  }
                  disabled={isAnswered}
                  placeholder={
                    mode === "timed"
                      ? "Write your answer..."
                      : "Write your answer — AI will provide detailed feedback..."
                  }
                  className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 min-h-[120px] resize-none"
                />
                {!isAnswered && (
                  <p className="text-xs text-slate-600">
                    {mode === "assisted"
                      ? "Write a thorough answer — the AI will provide detailed feedback."
                      : "Write a thorough answer — the AI will grade based on conceptual accuracy."}
                  </p>
                )}
              </div>
            )}

            {/* "Answer locked in" cue + Edit Answer button.
                Both Timed and Untimed Practice show only this neutral
                acknowledgment (no correctness reveal). The Edit Answer
                button resets the result and re-enables the input so the
                user can modify their answer — the next Submit re-grades
                via the API and upserts the existing answer row. */}
            {isAnswered && curState.result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg px-4 py-3 border border-white/[0.07] bg-white/[0.02] flex items-center justify-between gap-3 text-sm text-slate-400"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="truncate">
                    Answer locked in. Full results at the end of the exam.
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isGrading}
                  onClick={() =>
                    updateQState(currentQuestion.id, { result: null })
                  }
                  className="border-white/[0.10] text-slate-300 hover:bg-white/[0.05] hover:text-white shrink-0 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Edit answer
                </Button>
              </motion.div>
            )}

            {/* ===== Prev / Submit / Next ===== */}
            <div className="flex items-center justify-between gap-3">
              {/* Previous */}
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentIdx === 0 || isGrading}
                className={cn(
                  "border-white/[0.08] text-slate-300 hover:bg-white/[0.04] hover:text-white gap-1.5 transition-all duration-200",
                  currentIdx === 0 && "invisible"
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Prev
              </Button>

              {/* Center: Submit (only if unanswered) */}
              <div className="flex-1 flex justify-center">
                {!isAnswered && (
                  <Button
                    onClick={submitAnswer}
                    disabled={submitDisabled}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-8 gap-2 transition-colors duration-150"
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

              {/* Next */}
              <Button
                variant="outline"
                onClick={goNext}
                disabled={currentIdx >= questions.length - 1 || isGrading}
                className={cn(
                  "border-white/[0.08] text-slate-300 hover:bg-white/[0.04] hover:text-white gap-1.5 transition-all duration-200",
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

// ─── Public export — wraps XPBurstProvider ───────────────────────────────────

export default function ExamEngine(props: ExamEngineProps) {
  return (
    <XPBurstProvider>
      <ExamEngineInner {...props} />
    </XPBurstProvider>
  );
}
