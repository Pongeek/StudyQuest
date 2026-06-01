"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, Zap, ArrowRight, CheckCircle, XCircle, RotateCcw, Sparkles, Loader2, AlertTriangle, Dice5 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Confetti from "@/components/effects/Confetti";
import AnimatedCounter from "@/components/effects/AnimatedCounter";
import MarkdownContent from "./MarkdownContent";
import { useSound } from "@/lib/useSound";
import { toast } from "sonner";

interface AnswerResult {
  questionId: string;
  question: string;
  userAnswer: string;
  score: number;
  feedback: string;
  type: "mcq" | "open";
}

interface SessionDebriefProps {
  xpEarned: number;
  scorePct: number;
  debrief: {
    strengths: string[];
    gaps: string[];
    next_topic: string;
    reason: string;
  } | null;
  topicTitle: string;
  courseId: string;
  topicId: string;
  sessionId?: string; // used for Feynman Mode CTA
  /** If the session bumped the topic to a new mastery tier, this gets
   *  forwarded to the Course Map URL so the matching node plays the
   *  one-shot evolution celebration on arrival. */
  masteryEvolution?: { topicId: string; fromLevel: number; toLevel: number } | null;
  /** Loremaster one-liner describing how confidence shifted the SR schedule.
   *  Hidden when null (no confident or guessed answers in the session, or
   *  the session's confidence didn't STRICTLY change the SR quality). */
  confidenceEffect?: {
    kind: "overconfident-stumble" | "confident-mastery" | "lucky-win";
    line: string;
  } | null;
  results: AnswerResult[];
}

function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

export default function SessionDebrief({
  xpEarned,
  scorePct,
  debrief,
  topicTitle,
  courseId,
  topicId,
  sessionId,
  masteryEvolution,
  confidenceEffect,
  results,
}: SessionDebriefProps) {
  // Build the Course Map href, appending the evolution event when present so
  // the destination CourseMap can play the celebration once and self-clear.
  const courseMapHref = masteryEvolution
    ? `/dashboard/courses/${courseId}?evolved=${encodeURIComponent(
        `${masteryEvolution.topicId}:${masteryEvolution.fromLevel}:${masteryEvolution.toLevel}`
      )}`
    : `/dashboard/courses/${courseId}`;
  const router = useRouter();
  const { play: playSfx } = useSound();
  const [feynmanLoading, setFeynmanLoading] = useState(false);
  const isPassing = scorePct >= 70;
  const isPerfect = scorePct >= 95;
  const showFeynman = scorePct < 60;

  const handleFeynman = async () => {
    if (feynmanLoading) return;
    setFeynmanLoading(true);
    try {
      const res = await fetch("/api/feynman/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, quizSessionId: sessionId }),
      });
      if (!res.ok) throw new Error("Failed to start Feynman session");
      const { sessionId: feynmanSessionId } = await res.json();
      router.push(`/dashboard/courses/${courseId}/topics/${topicId}/feynman/${feynmanSessionId}`);
    } catch {
      toast.error("Could not start Feynman session. Please try again.");
      setFeynmanLoading(false);
    }
  };

  // Play a session-complete tone when the debrief mounts. Passing scores get
  // a satisfying up-tone + an XP ping tiered by the amount earned; failing
  // scores get a softer "wrong"-style descending tone so the moment still
  // has audible feedback without celebrating.
  useEffect(() => {
    if (isPassing) {
      playSfx("reviewComplete");
      const xpTier: "normal" | "big" | "critical" =
        xpEarned >= 150 ? "critical" : xpEarned >= 60 ? "big" : "normal";
      // Delay the XP ping slightly so it stacks under the complete tone
      // instead of muddying it.
      const t = setTimeout(() => playSfx("xp", xpTier), 280);
      return () => clearTimeout(t);
    } else {
      playSfx("wrong");
    }
  }, [isPassing, xpEarned, playSfx]);
  const rtl = isRTL(topicTitle) || results.some((r) => isRTL(r.question));

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir={rtl ? "rtl" : "ltr"}>
      {/* Confetti on passing score */}
      {isPassing && <Confetti trigger={1} count={isPerfect ? 200 : 100} duration={isPerfect ? 5000 : 3500} />}

      {/* Score hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
        className={cn(
          "rpg-card rounded-2xl p-6 sm:p-10 text-center relative overflow-hidden",
          isPerfect
            ? "!border-amber-400/30"
            : isPassing
              ? "!border-emerald-500/20"
              : "!border-slate-700/30"
        )}
      >

        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
            className="text-5xl sm:text-7xl mb-4"
          >
            {isPerfect ? "👑" : isPassing ? "🎉" : "💪"}
          </motion.div>

          <div className={cn(
            "text-5xl sm:text-6xl font-extrabold mb-2 animate-score-burst tabular-nums tracking-tight",
            isPerfect ? "text-amber-400" :
            isPassing ? "text-emerald-400" : "text-white"
          )}>
            <AnimatedCounter value={Math.round(scorePct)} suffix="%" duration={1.5} delay={0.2} />
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-slate-400 mb-6 text-sm"
          >
            {isPerfect ? "Perfect score on " :
             isPassing ? "Great work on " : "Keep practicing — "}
            <strong className="text-white">{topicTitle}</strong>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5, type: "spring" }}
            className="inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 border bg-amber-500/15 border-amber-500/30"
          >
            <Zap className="w-5 h-5 text-amber-400" />
            <AnimatedCounter
              value={xpEarned}
              prefix="+"
              suffix=" XP"
              duration={1.2}
              delay={0.6}
              className="text-amber-400 font-extrabold text-lg"
            />
          </motion.div>
        </div>
      </motion.div>

      {/* ── Confidence-effect chip ──
            Surfaces when at least one answer had a non-neutral confidence
            rating AND that rating moved the SR schedule (strict > guard
            in describeConfidenceEffect). Hidden cleanly otherwise. */}
      {confidenceEffect && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className={cn(
            "pixel-border px-3.5 py-2.5 flex items-center justify-center gap-2.5 relative text-center",
            confidenceEffect.kind === "overconfident-stumble" &&
              "bg-red-500/10 text-red-200",
            confidenceEffect.kind === "confident-mastery" &&
              "bg-emerald-500/10 text-emerald-200",
            confidenceEffect.kind === "lucky-win" &&
              "bg-amber-500/10 text-amber-200",
          )}
          role="status"
          aria-live="polite"
        >
          {/* Pixel-nail corners — kind-tinted to match the chrome family. */}
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 left-1.5 w-1.5 h-1.5 z-[2]",
              confidenceEffect.kind === "overconfident-stumble" && "bg-red-400",
              confidenceEffect.kind === "confident-mastery" && "bg-emerald-400",
              confidenceEffect.kind === "lucky-win" && "bg-amber-400",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 right-1.5 w-1.5 h-1.5 z-[2]",
              confidenceEffect.kind === "overconfident-stumble" && "bg-red-400",
              confidenceEffect.kind === "confident-mastery" && "bg-emerald-400",
              confidenceEffect.kind === "lucky-win" && "bg-amber-400",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute bottom-1.5 left-1.5 w-1.5 h-1.5 z-[2]",
              confidenceEffect.kind === "overconfident-stumble" && "bg-red-400",
              confidenceEffect.kind === "confident-mastery" && "bg-emerald-400",
              confidenceEffect.kind === "lucky-win" && "bg-amber-400",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute bottom-1.5 right-1.5 w-1.5 h-1.5 z-[2]",
              confidenceEffect.kind === "overconfident-stumble" && "bg-red-400",
              confidenceEffect.kind === "confident-mastery" && "bg-emerald-400",
              confidenceEffect.kind === "lucky-win" && "bg-amber-400",
            )}
          />

          {confidenceEffect.kind === "overconfident-stumble" && (
            <AlertTriangle aria-hidden className="w-4 h-4 shrink-0" />
          )}
          {confidenceEffect.kind === "confident-mastery" && (
            <Sparkles aria-hidden className="w-4 h-4 shrink-0" />
          )}
          {confidenceEffect.kind === "lucky-win" && (
            <Dice5 aria-hidden className="w-4 h-4 shrink-0" />
          )}

          <p className="text-sm leading-snug">{confidenceEffect.line}</p>
        </motion.div>
      )}

      {/* AI Debrief */}
      {debrief && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="rpg-card rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <h2 className="font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            AI Study Coach
          </h2>

          {debrief.strengths.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold">
                What you understood well
              </p>
              <ul className="space-y-1.5">
                {debrief.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {debrief.gaps.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold">
                Needs more work
              </p>
              <ul className="space-y-1.5">
                {debrief.gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {debrief.next_topic && (
            <div className="bg-indigo-500/10 border border-indigo-500/15 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Recommended next</p>
              <p className="text-sm font-bold text-indigo-300">{debrief.next_topic}</p>
              <p className="text-xs text-slate-400 mt-1">{debrief.reason}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Per-question summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="rpg-card rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <h2 className="font-bold text-white">Question Breakdown</h2>
        {results.map((r, i) => (
          <div
            key={r.questionId}
            className={cn(
              "rounded-xl p-4 border text-sm",
              r.score >= 0.7
                ? "border-green-500/15 bg-green-900/10"
                : "border-red-500/15 bg-red-900/10"
            )}
          >
            <div className="flex items-start gap-2 mb-2">
              {r.score >= 0.7 ? (
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="text-slate-300 font-semibold flex-1 min-w-0">
                <span className="text-slate-500 me-1">Q{i + 1}:</span>
                <MarkdownContent>{r.question}</MarkdownContent>
              </div>
            </div>
            <MarkdownContent className="text-xs text-slate-400 ms-6">
              {r.feedback}
            </MarkdownContent>
          </div>
        ))}
      </motion.div>

      {/* Feynman Mode CTA — only shown when score < 60% */}
      {showFeynman && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="rpg-card rounded-2xl p-5 border border-purple-800/40 bg-purple-950/10 text-center space-y-3"
        >
          <div className="text-2xl">🎓</div>
          <div>
            <h3 className="text-sm font-bold text-white">Struggling with this topic?</h3>
            <p className="text-xs text-slate-400 mt-1">
              Try <span className="text-purple-400 font-semibold">Feynman Mode</span> — teach the concept to an AI student.
              If you can explain it, you truly understand it.
            </p>
          </div>
          <Button
            onClick={handleFeynman}
            disabled={feynmanLoading}
            className="bg-purple-700 hover:bg-purple-600 text-white border border-purple-500/40 gap-2 w-full sm:w-auto"
          >
            {feynmanLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "🎓"
            )}
            {feynmanLoading ? "Starting session…" : "Teach It Back"}
          </Button>
        </motion.div>
      )}

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {/* router.refresh() here invalidates the dashboard layout's
            cached `total_xp` / `current_streak` BEFORE we navigate, so
            the nav HUD on the destination page shows the new level / XP. */}
        <Link
          href={`/dashboard/courses/${courseId}/topics/${topicId}`}
          className="flex-1"
          onClick={() => router.refresh()}
        >
          <Button variant="outline" className="w-full border-slate-700/50 text-slate-300 gap-2 hover:bg-white/5">
            <RotateCcw className="w-4 h-4" /> Study Again
          </Button>
        </Link>
        <Link
          href={courseMapHref}
          className="flex-1"
          onClick={() => router.refresh()}
        >
          <Button className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium gap-2">
            Course Map <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
