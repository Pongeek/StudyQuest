"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, XCircle, ArrowRight, Loader2,
  Swords, Shield, Skull, Zap, Trophy, RotateCcw, Sparkles,
  Flame, Star, BookOpen, ChevronLeft, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Confetti from "@/components/effects/Confetti";
import AnimatedCounter from "@/components/effects/AnimatedCounter";
import MarkdownContent from "@/components/quiz/MarkdownContent";
import MarkdownInline from "@/components/quiz/MarkdownInline";
import {
  calculateLevel,
  xpProgressInCurrentLevel,
  MASTERY_LABELS,
  getLevelTitle,
} from "@/lib/xp";
import { XPBurstProvider, useXPBurst } from "@/components/effects/XPBurst";
import { useSound } from "@/lib/useSound";
import LevelUpOverlay from "@/components/effects/LevelUpOverlay";
import AchievementUnlockOverlay, {
  type UnlockedAchievement,
} from "@/components/effects/AchievementUnlockOverlay";
import GradingOverlay from "@/components/effects/GradingOverlay";

// ─── Types ────────────────────────────────────────────────────────────────────

function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

type Phase = "lobby" | "combat" | "victory";
type BossAnim = "idle" | "hit" | "laugh" | "defeat";

interface FloatNum {
  id: number;
  text: string;
  color: string;
  x: number; // percentage from left of parent
  y: number; // percentage from top
}

interface BossQuestion {
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
  xpGained: number;
}

export interface BossFightUser {
  name: string;
  totalXp: number;
  streak: number;
}

export interface PreppedTopic {
  title: string;
  masteryLevel: number; // 0–5
}

interface BossFightEngineProps {
  sessionId: string;
  episodeId: string;
  courseId: string;
  questions: BossQuestion[];
  episodeTitle: string;
  user: BossFightUser;
  preppedTopics?: PreppedTopic[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTitleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function rankFromAccuracy(pct: number): { rank: string; flavor: string } {
  if (pct >= 95) return { rank: "S", flavor: "Legendary Clear" };
  if (pct >= 80) return { rank: "A", flavor: "Heroic" };
  if (pct >= 65) return { rank: "B", flavor: "Solid" };
  if (pct >= 50) return { rank: "C", flavor: "Narrow" };
  return { rank: "D", flavor: "Pyrrhic" };
}

/** Derive per-answer XP gain for the trial review strip */
function xpForAnswer(r: AnswerResult) {
  return r.xpGained ?? (r.score >= 0.7 ? (r.type === "mcq" ? 15 : 27) : 0);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Segmented HP bar (boss or hero). */
function SegmentedBar({
  value,
  max = 100,
  segments = 10,
  colorClass,
  gradientMode = false,
}: {
  value: number;
  max?: number;
  segments?: number;
  colorClass?: string;
  gradientMode?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex gap-0.5 w-full h-3">
      {Array.from({ length: segments }, (_, i) => {
        const segPct = ((i + 1) / segments) * 100;
        const filled = pct >= segPct;
        const gradColor = gradientMode
          ? pct <= 30
            ? "bg-red-500"
            : pct <= 60
            ? "bg-amber-500"
            : "bg-yellow-400"
          : colorClass ?? "bg-emerald-500";
        return (
          <motion.div
            key={i}
            className={cn(
              "flex-1 rounded-sm transition-all duration-300",
              filled ? gradColor : "bg-white/[0.06]"
            )}
            animate={{ opacity: filled ? 1 : 0.4 }}
            transition={{ duration: 0.3, delay: i * 0.02 }}
          />
        );
      })}
    </div>
  );
}

/** Trial dot progress row */
function TrialDots({
  total,
  current,
  results,
}: {
  total: number;
  current: number;
  results: AnswerResult[];
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const done = i < results.length;
        const correct = done && r.score >= 0.7;
        const active = i === current;
        return (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-200",
              done
                ? correct
                  ? "bg-emerald-400"
                  : "bg-red-400"
                : active
                ? "bg-amber-400 scale-125"
                : "bg-white/20"
            )}
          />
        );
      })}
    </div>
  );
}

/** Mastery pill */
function MasteryPill({ level }: { level: number }) {
  // Level 0 in MASTERY_LABELS is "Locked", which is the wrong word in a
  // boss-fight loadout context (the topic isn't gated — the user just
  // hasn't trained on it yet). Override to "Not yet" at level 0.
  const label = level === 0 ? "Not yet" : MASTERY_LABELS[Math.min(level, 5)];
  const colors = [
    "bg-slate-700/30 text-slate-500",
    "bg-slate-600/40 text-slate-300",
    "bg-green-900/40 text-green-400",
    "bg-blue-900/40 text-blue-400",
    "bg-purple-900/40 text-purple-400",
    "bg-amber-900/40 text-amber-400",
  ];
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
        colors[Math.min(level, 5)]
      )}
    >
      {label}
    </span>
  );
}

// ─── Main Component (inner, consumes XPBurstProvider) ────────────────────────

function BossFightEngineInner({
  sessionId,
  episodeId: _episodeId,
  courseId,
  questions,
  episodeTitle,
  user,
  preppedTopics = [],
}: BossFightEngineProps) {
  const { fireBurst } = useXPBurst();
  const router = useRouter();
  const { play: playSfx } = useSound();

  // ── Phase state machine ──
  const [phase, setPhase] = useState<Phase>("lobby");

  // ── Combat state ──
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<{
    score: number;
    feedback: string;
    correct_answer: string;
    explanation: string;
  } | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  // Drives the full-screen GradingOverlay during session-completion (the
  // long AI-grading wait), separate from per-answer `isGrading`.
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [results, setResults] = useState<AnswerResult[]>([]);

  // ── RPG state ──
  const [heroHp, setHeroHp] = useState(100);
  const [combo, setCombo] = useState(0);
  const maxComboRef = useRef(0);
  const [bossAnim, setBossAnim] = useState<BossAnim>("idle");
  const [floatNums, setFloatNums] = useState<FloatNum[]>([]);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const floatIdRef = useRef(0);

  // ── Victory / celebration overlays ──
  const [summary, setSummary] = useState<{
    xpEarned: number;
    scorePct: number;
    passed: boolean;
    debrief: { xpBreakdown?: Record<string, number>; [k: string]: unknown };
    newAchievements: UnlockedAchievement[];
    masteryEvolution: { topicId: string; fromLevel: number; toLevel: number } | null;
  } | null>(null);
  const [celebrationPhase, setCelebrationPhase] = useState<
    "none" | "level-up" | "achievements" | "done"
  >("none");
  const [levelUpInfo, setLevelUpInfo] = useState<{
    fromLevel: number;
    toLevel: number;
    newRank?: string;
  } | null>(null);
  const [pendingAchievements, setPendingAchievements] = useState<UnlockedAchievement[]>([]);

  // ── Derived ──
  const totalTrials = questions.length;
  const correctCount = results.filter((r) => r.score >= 0.7).length;
  const bossHp = totalTrials > 0
    ? Math.max(0, 100 - correctCount * Math.ceil(100 / totalTrials))
    : 100;
  const xpGainedSoFar = results.reduce((s, r) => s + r.xpGained, 0);
  const currentQuestion = questions[currentIdx];
  const isAnswered = answerResult !== null;
  const isCorrect = isAnswered && answerResult.score >= 0.7;

  // ── Boss anim helpers ──
  const bossAnimTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBossAnim = useCallback((anim: BossAnim, duration = 700) => {
    setBossAnim(anim);
    if (bossAnimTimeout.current) clearTimeout(bossAnimTimeout.current);
    if (anim !== "defeat") {
      bossAnimTimeout.current = setTimeout(() => setBossAnim("idle"), duration);
    }
  }, []);

  // ── Float number spawn ──
  const spawnFloat = useCallback((text: string, color: string) => {
    const id = ++floatIdRef.current;
    const x = 30 + Math.random() * 40;
    const y = 20 + Math.random() * 30;
    setFloatNums((prev) => [...prev, { id, text, color, x, y }]);
    setTimeout(() => {
      setFloatNums((prev) => prev.filter((f) => f.id !== id));
    }, 1200);
  }, []);

  const addLog = useCallback((entry: string) => {
    setBattleLog((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  // ── Submit answer ──
  const submitAnswer = async () => {
    if (!currentQuestion) return;
    const userAnswer =
      currentQuestion.type === "mcq" ? selectedOption || "" : openAnswer.trim();
    if (!userAnswer) {
      toast.error("Please provide an answer before striking.");
      return;
    }

    setIsGrading(true);
    try {
      const res = await fetch(`/api/boss-fight/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQuestion.id, userAnswer }),
      });
      if (!res.ok) throw new Error("Failed to grade answer");
      const { score, feedback } = await res.json();

      const isHit = score >= 0.7;
      // Calculate per-question XP (boss rates)
      let qXp = 0;
      if (currentQuestion.type === "mcq") {
        if (score === 1) qXp = 15;
      } else {
        if (score >= 0.9) qXp = 38;
        else if (score >= 0.7) qXp = 27;
        else if (score >= 0.5) qXp = 15;
      }

      setAnswerResult({
        score,
        feedback,
        correct_answer: currentQuestion.correct_answer,
        explanation: currentQuestion.explanation,
      });

      setResults((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          question: currentQuestion.content,
          userAnswer,
          score,
          feedback,
          type: currentQuestion.type,
          xpGained: qXp,
        },
      ]);

      if (isHit) {
        triggerBossAnim("hit");
        const dmg = Math.ceil(100 / totalTrials);
        spawnFloat(`-${dmg} HP`, "#ef4444");
        setTimeout(() => spawnFloat(`+${qXp} XP`, "#f59e0b"), 200);

        const newCombo = combo + 1;
        setCombo(newCombo);
        if (newCombo > maxComboRef.current) maxComboRef.current = newCombo;

        // Fire XP burst — combo sub-burst when applicable
        // TODO: wire combo bonus into server XP calculation
        fireBurst({
          amount: qXp,
          combo: newCombo >= 2 ? newCombo : undefined,
        });

        // Audio: you dealt damage to the boss → soft thud + XP ping + combo
        playSfx("bossMiss"); // "boss miss" = boss took the hit (named from hero's POV)
        const xpTier: "normal" | "big" | "critical" =
          qXp >= 61 ? "critical" : qXp >= 21 ? "big" : "normal";
        playSfx("xp", xpTier);
        if (newCombo >= 2) playSfx("combo", newCombo);

        addLog(
          newCombo >= 2
            ? `⚡ Combo x${newCombo}! Critical Strike on Q${currentIdx + 1}!`
            : `✓ Hit on Q${currentIdx + 1} (+${qXp} XP)`
        );
      } else {
        triggerBossAnim("laugh");
        setHeroHp((h) => Math.max(0, h - 15));
        setCombo(0);
        spawnFloat("-15 HP", "#ef4444");
        // Audio: hero took damage → sharper percussive sound
        playSfx("bossHit");
        addLog(`✗ Miss on Q${currentIdx + 1} (-15 HP)`);
      }
    } catch (err) {
      console.error("[BossFightEngine] answer grading failed:", err);
      toast.error("Failed to grade your answer. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  // ── Next question / complete ──
  const nextQuestion = async () => {
    if (currentIdx + 1 >= questions.length) {
      await completeBossFight();
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setOpenAnswer("");
      setAnswerResult(null);
    }
  };

  const completeBossFight = async () => {
    setIsGrading(true);
    setIsFinalizing(true);
    try {
      const res = await fetch(`/api/boss-fight/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: results, maxCombo: maxComboRef.current }),
      });
      if (!res.ok) throw new Error("Failed to complete boss fight");
      const data = await res.json();
      setSummary(data);

      // NOTE: Do NOT call `router.refresh()` here. The boss page returns
      // null (→ 404) when `session.completed_at` is set — if we refresh
      // the server route now, the victory screen 404s immediately. The
      // nav refresh is fired by the back-to-* buttons in the victory
      // render below, so the layout is fresh only once the user leaves.

      if (data.passed) {
        triggerBossAnim("defeat", 9999);
        // Audio: dramatic descending tone marks the boss going down
        playSfx("bossDefeat");
      }

      // Determine celebration sequence before switching to victory phase
      const xpEarned: number = data.xpEarned ?? 0;
      const newAchievements: UnlockedAchievement[] = data.newAchievements ?? [];
      const prevLevel = calculateLevel(user.totalXp);
      const newLevel = calculateLevel(user.totalXp + xpEarned);

      if (newLevel > prevLevel) {
        const prevRank = getLevelTitle(prevLevel);
        const toRank = getLevelTitle(newLevel);
        setLevelUpInfo({
          fromLevel: prevLevel,
          toLevel: newLevel,
          newRank: prevRank !== toRank ? toRank : undefined,
        });
        setPendingAchievements(newAchievements);
        setCelebrationPhase("level-up");
      } else if (newAchievements.length > 0) {
        setPendingAchievements(newAchievements);
        setCelebrationPhase("achievements");
      } else {
        setCelebrationPhase("done");
      }

      setPhase("victory");
    } catch {
      toast.error("Failed to save your results.");
    } finally {
      setIsGrading(false);
      setIsFinalizing(false);
    }
  };

  // ─── LOBBY ──────────────────────────────────────────────────────────────────

  if (phase === "lobby") {
    const level = calculateLevel(user.totalXp);
    const rtlPage = isRTL(episodeTitle);
    // Show ALL episode topics — the loadout panel exists to confirm that
    // the boss covers the whole episode, not a subset. Unattempted topics
    // appear with masteryLevel 0 so the user sees the full scope at a glance.
    const displayTopics = preppedTopics;
    const masteredCount = displayTopics.filter((t) => t.masteryLevel >= 2).length;
    const attemptedCount = displayTopics.filter((t) => t.masteryLevel >= 1).length;

    return (
      <div className="min-h-screen" dir={rtlPage ? "rtl" : "ltr"}>
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href={`/dashboard/courses/${courseId}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Course Map
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* LEFT — Boss portrait card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="rpg-card-gold rounded-2xl overflow-hidden flex flex-col min-h-[420px]">
              {/* Tier ribbon */}
              <div className="px-5 pt-4">
                <span className="text-[11px] uppercase tracking-wider font-medium text-amber-400/80">
                  Episode Boss
                </span>
              </div>

              {/* Boss "portrait" — dark area with big Skull */}
              <div className="flex-1 flex items-center justify-center relative bg-black/30 my-3 mx-3 rounded-xl min-h-[220px]">
                <div className="text-center">
                  <Skull className="w-24 h-24 text-slate-300/60 mx-auto" />
                </div>
              </div>

              {/* Name plate */}
              <div className="px-5 pb-4">
                <h1 className="font-bold tracking-tight text-xl text-white leading-tight mb-3">
                  {episodeTitle}
                </h1>

                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rpg-card rounded-lg px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">HP</div>
                    <div className="font-bold text-red-400 text-sm">100</div>
                  </div>
                  <div className="rpg-card rounded-lg px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Trials</div>
                    <div className="font-bold text-white text-sm">{totalTrials}</div>
                  </div>
                  <div className="rpg-card rounded-lg px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Difficulty</div>
                    <div className="flex justify-center gap-0.5 mt-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-2 h-2 rounded-full",
                            i < 3 ? "bg-amber-400" : "bg-white/15"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT — Info + Hero */}
          <div className="space-y-4">
            {/* Bestiary blurb */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="rpg-card rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-sm text-white">Bestiary</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                The <span className="text-white font-semibold">{episodeTitle}</span> boss guards the
                knowledge of this episode. Its {totalTrials} trials draw from{" "}
                <span className="text-white font-semibold">every topic</span> in the episode — not
                just the ones you've practiced. Each miss costs 15 HP.
              </p>
            </motion.div>

            {/* Prep loadout — shows the FULL episode scope so it's clear the
                boss covers every topic, not just what's been practiced. */}
            {displayTopics.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="rpg-card rounded-2xl p-5"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-sm text-white">Your Loadout</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                    {attemptedCount}/{displayTopics.length} attempted · {masteredCount} mastered
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Every topic in this episode. Unattempted topics will still appear in the trial.
                </p>
                <div className="space-y-2.5">
                  {displayTopics.map((t) => (
                    <div key={t.title} className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "text-sm truncate",
                          t.masteryLevel >= 1 ? "text-slate-300" : "text-slate-500"
                        )}
                      >
                        {t.title}
                      </span>
                      <MasteryPill level={t.masteryLevel} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Hero stat block + CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="rpg-card-gold rounded-2xl p-5"
            >
              {/* Hero info */}
              <div className="flex items-center gap-3 mb-4">
                {/* Level badge */}
                <div
                  className="game-badge w-12 h-14 shrink-0"
                  aria-label={`Level ${level}`}
                >
                  <span className="font-bold text-amber-400 text-xl leading-none tabular-nums">
                    {level}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white tracking-tight truncate">{user.name}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      {user.totalXp.toLocaleString()} XP
                    </span>
                    {user.streak > 0 && (
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-400" />
                        {user.streak}d streak
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <Button
                onClick={() => setPhase("combat")}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2 transition-all duration-150"
                size="lg"
              >
                <Swords className="w-5 h-5" />
                Engage Boss
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ─── VICTORY ────────────────────────────────────────────────────────────────

  if (phase === "victory" && summary) {
    const { rank, flavor } = rankFromAccuracy(summary.scorePct);
    const rtlPage = results.some((r) => isRTL(r.question));
    const level = calculateLevel(user.totalXp);
    const newTotalXp = user.totalXp + summary.xpEarned;

    // Append the evolution event to course-map navigation when a boss bumped
    // a topic's mastery tier. The destination CourseMap plays the one-shot
    // celebration on the matching node, then strips the param.
    const courseMapHref = summary.masteryEvolution
      ? `/dashboard/courses/${courseId}?evolved=${encodeURIComponent(
          `${summary.masteryEvolution.topicId}:${summary.masteryEvolution.fromLevel}:${summary.masteryEvolution.toLevel}`
        )}`
      : `/dashboard/courses/${courseId}`;

    const handleLevelUpClose = () => {
      if (pendingAchievements.length > 0) {
        setCelebrationPhase("achievements");
      } else {
        setCelebrationPhase("done");
      }
    };

    const handleAchievementsDismissed = () => {
      setCelebrationPhase("done");
    };
    const progress = xpProgressInCurrentLevel(newTotalXp);
    const xpBreakdown = summary.debrief?.xpBreakdown ?? {};
    const trialsWon = results.filter((r) => r.score >= 0.7).length;
    const accuracy = Math.round(summary.scorePct);
    const hpLeft = Math.max(0, heroHp);

    return (
      <div className="min-h-screen" dir={rtlPage ? "rtl" : "ltr"}>
        {/* Confetti on pass */}
        {summary.passed && <Confetti trigger={1} count={140} duration={4500} />}

        {/* Level-up overlay */}
        {levelUpInfo && (
          <LevelUpOverlay
            show={celebrationPhase === "level-up"}
            fromLevel={levelUpInfo.fromLevel}
            toLevel={levelUpInfo.toLevel}
            newRank={levelUpInfo.newRank}
            onClose={handleLevelUpClose}
          />
        )}

        {/* Achievement overlay */}
        {celebrationPhase === "achievements" && pendingAchievements.length > 0 && (
          <AchievementUnlockOverlay
            achievements={pendingAchievements}
            onAllDismissed={handleAchievementsDismissed}
          />
        )}

        <div className="max-w-5xl mx-auto space-y-6">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center space-y-1"
          >
            <h1
              className={cn(
                "text-3xl sm:text-4xl font-bold tracking-tight",
                summary.passed ? "text-white" : "text-red-400"
              )}
            >
              {summary.passed ? "Boss Defeated" : "Boss Survives"}
            </h1>
            <p className="text-slate-400 text-sm">{flavor}</p>
          </motion.div>

          {/* Two-column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT — Defeated boss card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="rpg-card rounded-2xl p-6 relative overflow-hidden flex flex-col"
            >
              {/* Rank chip — top right */}
              <div className="absolute top-4 right-4 text-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-2xl",
                    summary.passed
                      ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                      : "bg-red-500/20 border border-red-500/30 text-red-400"
                  )}
                >
                  {rank}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Rank</div>
              </div>

              {/* Boss skull with defeat anim */}
              <div className="flex-1 flex items-center justify-center relative py-8">
                <div
                  className={cn(
                    "relative",
                    summary.passed ? "boss-defeat" : ""
                  )}
                >
                  <Skull
                    className={cn(
                      "w-28 h-28",
                      summary.passed ? "text-slate-500/40" : "text-slate-300/60"
                    )}
                  />
                </div>

                {/* DEFEATED stamp */}
                {summary.passed && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    aria-hidden
                  >
                    <span
                      className="font-black text-3xl tracking-widest select-none"
                      style={{
                        transform: "rotate(-25deg)",
                        color: "transparent",
                        WebkitTextStroke: "2px rgba(239,68,68,0.75)",
                        letterSpacing: "0.15em",
                      }}
                    >
                      DEFEATED
                    </span>
                  </div>
                )}
              </div>

              <div className="font-semibold text-white text-center mb-4">{episodeTitle}</div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rpg-card rounded-lg px-2 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Accuracy</div>
                  <div className="font-bold text-emerald-400 text-sm">{accuracy}%</div>
                </div>
                <div className="rpg-card rounded-lg px-2 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Trials Won</div>
                  <div className="font-bold text-white text-sm">{trialsWon}/{totalTrials}</div>
                </div>
                <div className="rpg-card rounded-lg px-2 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">HP Left</div>
                  <div className={cn("font-bold text-sm", hpLeft > 50 ? "text-emerald-400" : hpLeft > 25 ? "text-amber-400" : "text-red-400")}>
                    {hpLeft}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* RIGHT — XP burst + extras */}
            <div className="space-y-4">
              {/* XP burst card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rpg-card-gold rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">XP Earned</span>
                </div>
                <div className="text-5xl font-bold tracking-tight text-amber-400 mb-4">
                  <AnimatedCounter value={summary.xpEarned} prefix="+" suffix=" XP" duration={1.5} delay={0.2} />
                </div>

                {/* Breakdown rows */}
                {Object.entries(xpBreakdown).length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {Object.entries(xpBreakdown).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{toTitleCase(k)}</span>
                        <span className="font-semibold text-amber-300">+{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Level progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Level {level}</span>
                    <span>{progress.current}/{progress.needed} XP</span>
                  </div>
                  <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full xp-shimmer"
                      initial={{ width: `${xpProgressInCurrentLevel(user.totalXp).percentage}%` }}
                      animate={{ width: `${progress.percentage}%` }}
                      transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Achievements */}
              {summary.newAchievements?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="rounded-2xl p-4 border border-purple-500/20 bg-purple-900/10"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-sm text-white">Achievements Unlocked</span>
                  </div>
                  <div className="space-y-2">
                    {summary.newAchievements.map((ach) => (
                      <div key={ach.name} className="flex items-center gap-3">
                        <span className="text-xl">{ach.icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{ach.name}</div>
                          <div className="text-xs text-slate-400">{ach.description}</div>
                        </div>
                        <span className="ml-auto text-xs font-semibold text-amber-400 shrink-0">+{ach.xp_reward}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Mastery gains */}
              {preppedTopics.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="rpg-card rounded-2xl p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-sm text-white">Mastery Progress</span>
                  </div>
                  <div className="space-y-3">
                    {preppedTopics.slice(0, 4).map((t) => {
                      const fromPct = (t.masteryLevel / 5) * 100;
                      const toPct = (Math.min(t.masteryLevel + (summary.passed ? 1 : 0), 5) / 5) * 100;
                      return (
                        <div key={t.title} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 truncate">{t.title}</span>
                            <MasteryPill level={Math.min(t.masteryLevel + (summary.passed ? 1 : 0), 5)} />
                          </div>
                          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-indigo-500"
                              initial={{ width: `${fromPct}%` }}
                              animate={{ width: `${toPct}%` }}
                              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Trial review strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 }}
            className="rpg-card rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-sm text-white">Trial Review</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {results.map((r, i) => (
                <div
                  key={r.questionId}
                  className={cn(
                    "rounded-xl p-3 border text-center",
                    r.score >= 0.7
                      ? "border-emerald-500/20 bg-emerald-900/10"
                      : "border-red-500/20 bg-red-900/10"
                  )}
                >
                  <div className="text-xs text-slate-500 mb-1">Trial {i + 1}</div>
                  <div className="flex justify-center mb-1">
                    {r.score >= 0.7 ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  {xpForAnswer(r) > 0 && (
                    <div className="text-xs font-semibold text-amber-400">+{xpForAnswer(r)}</div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            {/* Refresh the route segment ON CLICK so the dashboard layout's
                cached `total_xp` / `current_streak` is invalidated just
                before we navigate — the destination page then renders with
                fresh nav HUD values. Doing this here (rather than right
                after /complete returns) avoids 404'ing the victory screen,
                since this page's server fetcher returns null when the
                session has `completed_at` set. */}
            {!summary.passed && (
              <Link
                href={`/dashboard/courses/${courseId}`}
                className="flex-1"
                onClick={() => router.refresh()}
              >
                <Button
                  variant="outline"
                  className="w-full border-slate-700/50 text-slate-300 gap-2 hover:bg-white/5"
                >
                  <RotateCcw className="w-4 h-4" /> Train More
                </Button>
              </Link>
            )}
            {summary.passed && (
              <Link
                href={`/dashboard/courses/${courseId}`}
                className="flex-1"
                onClick={() => router.refresh()}
              >
                <Button
                  variant="outline"
                  className="w-full border-slate-700/50 text-slate-300 gap-2 hover:bg-white/5"
                  disabled
                >
                  <RotateCcw className="w-4 h-4" /> Rematch
                </Button>
              </Link>
            )}
            <Link
              href={courseMapHref}
              className="flex-1"
              onClick={() => router.refresh()}
            >
              <Button className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2">
                <Trophy className="w-4 h-4" /> Return to Realm
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── COMBAT ─────────────────────────────────────────────────────────────────

  if (!currentQuestion) return null;
  const rtl = isRTL(currentQuestion.content);

  return (
    <div className="min-h-screen">
      {/* Grading overlay — full-screen sigil shown while Claude grades the
          boss-fight answers and decides on mastery progression. Mounts above
          all combat UI; LevelUpOverlay/Achievement overlays sit above it. */}
      <GradingOverlay show={isFinalizing} kind="boss" />

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setPhase("lobby")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors border border-slate-700/50 rounded-lg px-3 py-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Retreat
        </button>
        <TrialDots total={totalTrials} current={currentIdx} results={results} />
        <span className="text-xs text-slate-500 tabular-nums">
          {currentIdx + 1}/{totalTrials}
        </span>
      </div>

      {/* Boss stage card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rpg-card rounded-2xl p-5 mb-6 relative overflow-hidden"
      >
        <div className="flex items-center gap-4">
          {/* Boss skull (anim target) */}
          <div className="relative shrink-0">
            <div
              className={cn(
                "transition-transform",
                bossAnim === "hit" && "boss-hit",
                bossAnim === "laugh" && "boss-laugh",
                bossAnim === "defeat" && "boss-defeat"
              )}
            >
              <Skull className="w-12 h-12 text-slate-400" />
            </div>

            {/* Floating numbers */}
            {floatNums.map((f) => (
              <span
                key={f.id}
                className="float-num"
                style={{ color: f.color, left: `${f.x}%`, top: `${f.y}%` }}
              >
                {f.text}
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="font-bold text-white text-sm leading-tight truncate">{episodeTitle}</div>
                <div className="text-[11px] uppercase tracking-wider font-medium text-amber-400/80">
                  Episode Boss
                </div>
              </div>
              <div className="text-xs font-bold text-red-400 shrink-0 ml-3">{bossHp}%</div>
            </div>
            <SegmentedBar value={bossHp} segments={10} gradientMode />
          </div>
        </div>
      </motion.div>

      {/* Main two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <div
              className={cn(
                "rpg-card rounded-2xl p-5 sm:p-7 space-y-5",
                !isAnswered && answerResult === null
                  ? "!border-red-500/15"
                  : isCorrect
                  ? "!border-emerald-500/20"
                  : "!border-red-500/20"
              )}
              dir={rtl ? "rtl" : "ltr"}
            >
              {/* Header */}
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
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                    Boss
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-2 h-2 rounded-full",
                        i < currentQuestion.difficulty ? "bg-red-400" : "bg-slate-700"
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
                <div className={cn("space-y-2.5", isAnswered && "animate-shake" in {} ? "" : "")}>
                  {currentQuestion.options.map((option, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    let state: "default" | "selected" | "correct" | "wrong" = "default";
                    if (isAnswered) {
                      if (option === currentQuestion.correct_answer) state = "correct";
                      else if (option === selectedOption && option !== currentQuestion.correct_answer)
                        state = "wrong";
                    } else if (option === selectedOption) {
                      state = "selected";
                    }

                    return (
                      <button
                        key={option}
                        disabled={isAnswered}
                        onClick={() => setSelectedOption(option)}
                        className={cn(
                          "w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-sm",
                          rtl ? "text-right flex-row-reverse" : "text-left",
                          state === "default" &&
                            "border-slate-700/50 bg-slate-800/30 text-slate-300 hover:border-red-500/40 hover:bg-red-500/5 hover:text-white",
                          state === "selected" &&
                            "border-indigo-500/60 bg-indigo-600/15 text-white",
                          state === "correct" &&
                            "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
                          state === "wrong" &&
                            "border-red-500/60 bg-red-500/10 text-red-300",
                          isAnswered && state === "default" && "opacity-40"
                        )}
                      >
                        {/* Key letter tile */}
                        <span
                          className={cn(
                            "w-6 h-6 flex items-center justify-center rounded shrink-0 text-xs font-bold mt-0.5",
                            state === "default" && "bg-slate-700/60 text-slate-400",
                            state === "selected" && "bg-indigo-500 text-white",
                            state === "correct" && "bg-emerald-500 text-white",
                            state === "wrong" && "bg-red-500 text-white",
                            isAnswered && state === "default" && "bg-slate-800/40 text-slate-600"
                          )}
                        >
                          {letter}
                        </span>
                        <MarkdownInline className="flex-1 leading-relaxed">{option.replace(/^[A-D]\.\s*/, "")}</MarkdownInline>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Open question */}
              {currentQuestion.type === "open" && (
                <Textarea
                  dir="auto"
                  value={openAnswer}
                  onChange={(e) => setOpenAnswer(e.target.value)}
                  disabled={isAnswered}
                  placeholder="Write your answer — this is a boss-level question, be thorough!"
                  className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-red-500/50 focus-visible:border-red-500/50 min-h-[120px] resize-none"
                />
              )}

              {/* Feedback */}
              <AnimatePresence>
                {isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-xl p-5 space-y-3 border",
                      isCorrect
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-red-500/10 border-red-500/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "font-bold text-sm",
                          isCorrect ? "text-emerald-300" : "text-red-300"
                        )}
                      >
                        {currentQuestion.type === "mcq"
                          ? isCorrect
                            ? "Critical Hit!"
                            : "Miss!"
                          : `Damage: ${Math.round(answerResult.score * 100)}%`}
                      </span>
                    </div>
                    <MarkdownContent className="text-sm text-slate-300">
                      {answerResult.feedback}
                    </MarkdownContent>
                    {!isCorrect && (
                      <div className="pt-3 border-t border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">
                          Correct answer
                        </p>
                        <MarkdownContent className="text-sm text-white">
                          {answerResult.correct_answer}
                        </MarkdownContent>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                {!isAnswered ? (
                  <Button
                    onClick={submitAnswer}
                    disabled={
                      isGrading ||
                      (currentQuestion.type === "mcq"
                        ? !selectedOption
                        : openAnswer.trim().length < 5)
                    }
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-8 gap-2"
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Grading…
                      </>
                    ) : (
                      <>
                        <Swords className="w-4 h-4" />
                        Strike!
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={nextQuestion}
                    disabled={isGrading}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 gap-2"
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : currentIdx + 1 >= questions.length ? (
                      <>
                        <Shield className="w-4 h-4" />
                        Final Strike!
                      </>
                    ) : (
                      <>
                        Next Trial <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Hero rail */}
        <div className="space-y-4">
          {/* Hero HP */}
          <div className="rpg-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Hero HP
              </span>
              <span className="text-xs font-bold text-emerald-400">{heroHp}</span>
            </div>
            <SegmentedBar value={heroHp} segments={10} colorClass="bg-emerald-500" />
          </div>

          {/* Combo pill */}
          <AnimatePresence>
            {combo >= 2 && (
              <motion.div
                key="combo"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="rpg-card-gold rounded-2xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">Combo</span>
                </div>
                <span className="text-2xl font-black text-amber-400 tabular-nums">x{combo}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rpg-card rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">XP Gained</div>
              <div className="font-bold text-amber-400 text-lg tabular-nums">+{xpGainedSoFar}</div>
            </div>
            <div className="rpg-card rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Hits</div>
              <div className="font-bold text-emerald-400 text-lg tabular-nums">
                {correctCount}/{results.length}
              </div>
            </div>
          </div>

          {/* Battle log */}
          {battleLog.length > 0 && (
            <div className="rpg-card rounded-2xl p-3 space-y-1 max-h-[180px] overflow-y-auto scrollbar-hide">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-bold">
                Battle Log
              </div>
              {battleLog.map((entry, i) => (
                <p key={i} className="text-xs text-slate-400 leading-relaxed">
                  {entry}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Public export — wraps XPBurstProvider ───────────────────────────────────

export default function BossFightEngine(props: BossFightEngineProps) {
  return (
    <XPBurstProvider>
      <BossFightEngineInner {...props} />
    </XPBurstProvider>
  );
}
