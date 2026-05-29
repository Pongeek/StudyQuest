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
  Swords,
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
import SessionDebrief from "./SessionDebrief";
import MarkdownContent from "./MarkdownContent";
import MarkdownInline from "./MarkdownInline";
import AnswerImagePicker from "./AnswerImagePicker";
import { XPBurstProvider, useXPBurst } from "@/components/effects/XPBurst";
import ComboHUD from "@/components/effects/ComboHUD";
import { useSound } from "@/lib/useSound";
import LevelUpOverlay from "@/components/effects/LevelUpOverlay";
import AchievementUnlockOverlay, {
  type UnlockedAchievement,
} from "@/components/effects/AchievementUnlockOverlay";
import GradingOverlay from "@/components/effects/GradingOverlay";
import RegenerateQuestionButton, {
  type RegeneratedQuestion,
} from "@/components/quiz/RegenerateQuestionButton";
import ConfidenceRow, { type Confidence } from "@/components/quiz/ConfidenceRow";
import ClarifierThread from "@/components/quiz/ClarifierThread";
import { calculateLevel, getLevelTitle, XP_REWARDS } from "@/lib/xp";
import { readClassifiedErrorFromResponse, classifyAiError } from "@/lib/ai-error";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  clearSessionDrafts,
} from "@/lib/answer-draft";

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
  /** Optional diagram image the student attached for this question (open Qs only) */
  openAnswerImage: File | null;
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
  /** Phase 1 pilot: student's self-rated confidence (set after grading). */
  confidence: "guessed" | "unsure" | "confident" | null;
  /** Phase 1 pilot: whether the "Why was I wrong?" thread is mounted. */
  clarifierOpen: boolean;
  /** Phase 1 pilot: id of the persisted quiz_answers row — needed by the
   *  confidence PATCH and the clarifier endpoint. Null until grading. */
  answerId: string | null;
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
  questions: initialQuestions,
  topicTitle,
  episodeTitle,
  userStreak,
  userTotalXp,
}: QuizEngineProps) {
  const { fireBurst } = useXPBurst();
  const router = useRouter();
  const { play: playSfx } = useSound();

  // The questions array is held in local state so the regenerate button
  // can swap a question in place without a page refresh (which would re-
  // mount the engine + blow away all in-flight answer state).
  const [questions, setQuestions] = useState(initialQuestions);

  // --- Per-question state map ---
  const [questionStates, setQuestionStates] = useState<Map<string, QuestionState>>(() => {
    const map = new Map<string, QuestionState>();
    initialQuestions.forEach((q, i) => {
      map.set(q.id, {
        selectedOption: null,
        openAnswer: "",
        openAnswerImage: null,
        result: null,
        visited: i === 0,
        skipped: false,
        confidence: null,
        clarifierOpen: false,
        answerId: null,
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

  // Ref for scrollable navigator + per-dot refs so we can auto-scroll the
  // current question into view on long quizzes.
  const navScrollRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Leave-quiz confirmation banner state — abandoning is non-destructive
  // (answers stay saved; user can resume by revisiting the topic URL later).
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // ─── Navigator scroll behavior ───
  // Auto-scroll the current dot into the visible area when it changes.
  // Hoisted above early returns (rules-of-hooks); see debrief/null branches.
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

  // Manual chevron-arrow scroll (left / right) for click-to-scroll discovery.
  // Hoisted above early returns (rules-of-hooks).
  const scrollNavBy = useCallback((direction: 1 | -1) => {
    const el = navScrollRef.current;
    if (!el) return;
    const amount = Math.max(140, Math.round(el.clientWidth * 0.7));
    el.scrollBy({ left: amount * direction, behavior: "smooth" });
  }, []);

  // Handle Leave-Quiz confirm → back to the topic landing. Session row stays
  // (not completed); the user can resume by revisiting the URL later.
  // Hoisted above early returns (rules-of-hooks).
  const handleLeaveConfirm = useCallback(() => {
    router.push(`/dashboard/courses/${courseId}/topics/${topicId}`);
  }, [router, courseId, topicId]);

  const currentQuestion = questions[currentIdx];

  // Helpers to read/write per-question state
  const getQState = useCallback(
    (qId: string): QuestionState =>
      questionStates.get(qId) ?? {
        selectedOption: null,
        openAnswer: "",
        openAnswerImage: null,
        result: null,
        visited: false,
        skipped: false,
        confidence: null,
        clarifierOpen: false,
        answerId: null,
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
          openAnswerImage: null,
          result: null,
          visited: false,
          skipped: false,
          confidence: null,
          clarifierOpen: false,
          answerId: null,
        };
        next.set(qId, { ...current, ...patch });
        return next;
      });
    },
    []
  );

  // ── Answer-draft persistence ────────────────────────────────────────────────
  // On mount, restore any drafted open-answer text from localStorage so a
  // mid-flow failure (Claude 429 / network drop / page refresh) doesn't
  // throw away the student's typed answer.
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

  // Debounced save: every open-answer keystroke debounces a localStorage
  // write so a mid-flow failure preserves the draft. Cleared on success
  // (see submitAnswer) and on session complete (see completeSession).
  const currentQuestionId = questions[currentIdx]?.id;
  const currentQuestionType = questions[currentIdx]?.type;
  const currentOpenAnswerText = currentQuestionId
    ? questionStates.get(currentQuestionId)?.openAnswer ?? ""
    : "";
  useEffect(() => {
    if (!currentQuestionId || currentQuestionType === "mcq") return;
    const timer = setTimeout(() => {
      saveDraft(sessionId, currentQuestionId, currentOpenAnswerText);
    }, 600);
    return () => clearTimeout(timer);
  }, [sessionId, currentQuestionId, currentQuestionType, currentOpenAnswerText]);

  // Derived counts
  const answeredCount = useMemo(
    () => Array.from(questionStates.values()).filter((s) => s.result !== null).length,
    [questionStates]
  );

  const unansweredCount = questions.length - answeredCount;

  // Swap a regenerated question into local state. The server has already
  // soft-replaced the old row, so on refresh the new question takes the
  // same slot (it inherited created_at). For this in-flight session, we
  // do the swap in JS so the engine keeps running without re-mount.
  const handleRegenerated = useCallback(
    (oldQuestionId: string, newQuestion: RegeneratedQuestion) => {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === oldQuestionId
            ? {
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
        next.delete(oldQuestionId);
        next.set(newQuestion.id, {
          selectedOption: null,
          openAnswer: "",
          openAnswerImage: null,
          result: null,
          visited: true,
          skipped: false,
          confidence: null,
          clarifierOpen: false,
          answerId: null,
        });
        return next;
      });
      // The old question's draft (if any) is orphaned in localStorage —
      // explicit clear keeps the bucket tidy.
      clearDraft(sessionId, oldQuestionId);
    },
    [sessionId]
  );

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
    const isOpen = currentQuestion.type !== "mcq";
    const userAnswer =
      currentQuestion.type === "mcq"
        ? qState.selectedOption ?? ""
        : qState.openAnswer.trim();
    const attachedImage = isOpen ? qState.openAnswerImage : null;

    // An open answer is valid if EITHER typed text OR an attached image is present.
    if (!userAnswer && !attachedImage) {
      toast.error("Please type an answer or attach a diagram before submitting.");
      return;
    }

    setIsGrading(true);
    try {
      // If an image is attached, send multipart so the file flows up.
      // Otherwise stick with JSON for the simpler / faster path.
      let res: Response;
      if (attachedImage) {
        const fd = new FormData();
        fd.append("sessionId", sessionId);
        fd.append("questionId", currentQuestion.id);
        fd.append("userAnswer", userAnswer);
        fd.append("topicTitle", topicTitle);
        fd.append("image", attachedImage);
        res = await fetch("/api/quiz/answers", {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch("/api/quiz/answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionId: currentQuestion.id,
            userAnswer,
            topicTitle,
          }),
        });
      }

      if (!res.ok) {
        // Classified error from the server tells us if it's retryable
        // (rate-limit / overload / network) vs config (auth / budget).
        // Either way the typed answer is preserved in localStorage.
        const classified = await readClassifiedErrorFromResponse(res);
        toast.error(classified.userMessage, { duration: 6000 });
        return;
      }
      const { score, feedback, answerId } = await res.json();

      // Grade succeeded — answer is now in the DB, drop the local draft.
      clearDraft(sessionId, currentQuestion.id);

      updateQState(currentQuestion.id, {
        result: {
          score,
          feedback,
          correct_answer: currentQuestion.correct_answer,
          explanation: currentQuestion.explanation,
        },
        skipped: false,
        answerId: answerId ?? null,
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
      // Caught by client-side error (network drop, fetch aborted, etc.).
      // Draft is already in localStorage, so the user only needs to retry.
      console.error("[QuizEngine] answer grading failed:", err);
      const classified = classifyAiError(err);
      toast.error(classified.userMessage, { duration: 6000 });
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

      // Session is locked server-side now — every per-question draft is
      // safely persisted as a real answer, so the localStorage copies are
      // no longer load-bearing.
      clearSessionDrafts(sessionId);

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
              <div className="flex items-center gap-2 min-w-0">
                <Swords className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="text-sm text-slate-400 font-medium truncate">{topicTitle}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-bold text-slate-400 tabular-nums">
                  <span className={cn(
                    answeredCount === questions.length ? "text-green-400" : "text-indigo-400"
                  )}>{answeredCount}</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  {questions.length}
                </span>
                {/* Leave Quiz — opens the confirmation banner below. Non-
                    destructive: answers stay saved, session row preserved. */}
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(true)}
                  aria-label="Leave quiz"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-white/[0.07] hover:border-red-500/30 rounded-lg px-2.5 py-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  Leave
                </button>
              </div>
            </div>

            {/* Dot navigator — chevron buttons for click-to-scroll discovery
                + auto-scroll-into-view on the current dot when navigating. */}
            <div className="flex items-center gap-1.5">
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

              <button
                type="button"
                onClick={() => scrollNavBy(1)}
                aria-label="Scroll question list right"
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
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
                    : "bg-indigo-500 hover:bg-indigo-400 text-white"
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
                  Leave this quiz? Your answers are{" "}
                  <strong className="text-white">saved automatically</strong> —
                  you can resume from the topic page any time.
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
                    Leave Quiz
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              {/* Question type badge + difficulty + regenerate */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "text-xs font-bold px-3 py-1 rounded-full border whitespace-nowrap",
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
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Regenerate: only available while the question is still
                      unanswered + we aren't mid-grade. Replaces the question
                      with a fresh AI variant — old row soft-replaced server-side. */}
                  {!isAnswered && (
                    <RegenerateQuestionButton
                      questionId={currentQuestion.id}
                      variant="inline"
                      disabled={isGrading}
                      onRegenerated={(nq) => handleRegenerated(currentQuestion.id, nq)}
                    />
                  )}
                  <div className="flex items-center gap-0.5" aria-label="Question difficulty">
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

                    // Letter prefix in its own tile + body in MarkdownInline.
                    // CRITICAL: button is flex + rtl:flex-row-reverse so the
                    // prefix is a real visual boundary. Without flex, bidi
                    // groups "A." and a leading Latin acronym ("NFA"/"DFA")
                    // in the body into one LTR run and renders them glued
                    // together (e.g. "C.NFA" instead of "C.  NFA …").
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
                        <span
                          className={cn(
                            "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors duration-200",
                            optionState === "default" && "bg-white/[0.05] text-slate-400",
                            optionState === "selected" && "bg-indigo-500/30 text-indigo-300",
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

              {/* Open question textarea */}
              {currentQuestion.type === "open" && (
                <div className="space-y-2">
                  <Textarea
                    dir="auto"
                    value={curState.openAnswer}
                    onChange={(e) =>
                      updateQState(currentQuestion.id, { openAnswer: e.target.value })
                    }
                    disabled={isAnswered}
                    placeholder="Write your answer here... Or attach a diagram below if drawing is easier."
                    className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 min-h-[120px] resize-none"
                  />
                  {/* Diagram / image attachment — Claude vision grades both
                      the typed text AND the attached image together. Critical
                      for CS theory / math / physics where the answer is
                      often a drawing (automaton, derivation, proof). */}
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
                        Write thoroughly -- the AI grades on conceptual accuracy.
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

                  {/* ── Phase 1 pilot: confidence row + clarifier ──
                       Both appear once the answer is graded AND we have
                       an answerId from the server (the PATCH + clarifier
                       endpoints key off it). ConfidenceRow is always
                       visible; the clarifier button only shows on
                       wrong / partial answers (score < 0.7). */}
                  {curState.answerId && (
                    <>
                      <ConfidenceRow
                        value={curState.confidence}
                        dir={rtl ? "rtl" : "ltr"}
                        onChange={(next: Confidence) => {
                          updateQState(currentQuestion.id, { confidence: next });
                          // Fire-and-forget. Silent on failure — the user
                          // already has the grade; confidence isn't critical-path.
                          fetch(
                            `/api/quiz/answers/${curState.answerId}/confidence`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ confidence: next }),
                            },
                          ).catch((err) =>
                            console.warn(
                              "[QuizEngine] confidence PATCH failed:",
                              err,
                            ),
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
                          answerKind="quiz"
                          answerId={curState.answerId}
                          dir={rtl ? "rtl" : "ltr"}
                          onClose={() =>
                            updateQState(currentQuestion.id, { clarifierOpen: false })
                          }
                        />
                      )}
                    </>
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
                          : // Open answer is submittable when EITHER ≥5 chars
                            // typed OR a diagram image attached — mirrors
                            // submitAnswer's own validation.
                            curState.openAnswer.trim().length < 5 &&
                            !curState.openAnswerImage)
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
