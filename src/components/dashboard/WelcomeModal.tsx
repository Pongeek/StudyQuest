"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  Swords,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * First-run Welcome Modal.
 *
 * Three-slide pixel-arcade carousel that introduces a brand-new user to
 * StudyQuest before they hit the empty dashboard. Mounted by
 * `dashboard/page.tsx` only when `users.onboarding_completed_at IS NULL`
 * (server-truth flag, NOT localStorage — sign-ins from new devices stay
 * silent once the user has finished or skipped the modal).
 *
 * Pacing rules:
 *   - User can advance via Next button, click a dot, hit → or Enter,
 *     or skip the whole thing via X / Esc / Skip text
 *   - Final slide swaps the indigo Next button for an amber
 *     "ENTER THE REALM" button — the one celebration moment of the flow
 *   - Closing always POSTs `/api/users/complete-onboarding` so the modal
 *     never re-fires. Even if the API call fails locally we still close
 *     to avoid trapping the user.
 *
 * Z-index 140 sits below LevelUpOverlay (150) and AchievementUnlockOverlay
 * (160), above ScrollOfWisdom (130). A new user shouldn't see any of those
 * higher overlays on first load, but the ordering is documented in
 * CLAUDE.md if it ever does happen.
 */
export default function WelcomeModal() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Non-fatal: if the API call fails (network / 500) we still close
      // locally rather than trap the user. The modal will re-show on next
      // mount, which is annoying but recoverable. Acceptable trade.
      await fetch("/api/users/complete-onboarding", { method: "POST" });
    } catch {
      // swallow — close anyway
    }
    setClosing(true);
  }, [submitting]);

  const next = useCallback(() => {
    if (index < SLIDES.length - 1) {
      setIndex((i) => i + 1);
    } else {
      close();
    }
  }, [index, close]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard navigation — Enter/→ advance, ← back, Esc skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, close]);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <AnimatePresence>
      {!closing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl"
          aria-modal="true"
          role="dialog"
          aria-labelledby="welcome-modal-title"
        >
          <motion.div
            initial={
              reduceMotion ? { opacity: 0 } : { scale: 0.94, y: 14, opacity: 0 }
            }
            animate={
              reduceMotion ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }
            }
            exit={
              reduceMotion ? { opacity: 0 } : { scale: 0.96, opacity: 0 }
            }
            transition={{ type: "spring", damping: 18, stiffness: 200 }}
            className="relative bg-slate-900/95 pixel-border text-indigo-500/80 max-w-md w-full px-6 py-8 sm:px-8 sm:py-10 text-center"
          >
            {/* Pixel nail corners — same vocabulary as the rest of the app */}
            <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400" />
            <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400" />
            <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-indigo-400" />
            <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400" />

            {/* Skip / close — top-right X */}
            <button
              type="button"
              onClick={close}
              aria-label="Skip welcome"
              disabled={submitting}
              className="absolute top-2.5 right-2.5 z-[2] p-1.5 text-slate-500 hover:text-white transition-colors disabled:opacity-50 pixel-focus outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Slide content — swaps with a soft horizontal slide */}
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={
                  reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }
                }
                animate={
                  reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }
                }
                exit={
                  reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }
                }
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="space-y-4 sm:space-y-5"
              >
                <div className="flex justify-center pt-1">{slide.icon}</div>
                <div>
                  <div className="font-pixel text-[9px] tracking-wider text-indigo-300/90 mb-2">
                    {slide.microLabel}
                  </div>
                  <h2
                    id="welcome-modal-title"
                    className="text-xl sm:text-2xl font-bold text-white tracking-tight"
                  >
                    {slide.title}
                  </h2>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                  {slide.body}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Dot pagination — clickable so the user can hop around */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={cn(
                    "w-1.5 h-1.5 transition-colors duration-200 pixel-focus outline-none",
                    i === index
                      ? "bg-indigo-400"
                      : "bg-slate-700 hover:bg-slate-500"
                  )}
                />
              ))}
            </div>

            {/* CTAs */}
            <div className="flex items-center justify-center gap-3 mt-5">
              {index > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="font-pixel text-[10px] tracking-wider text-slate-500 hover:text-white transition-colors px-3 py-2 pixel-focus outline-none"
                >
                  ← BACK
                </button>
              )}
              <button
                type="button"
                onClick={next}
                disabled={submitting}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-5 py-2.5 font-pixel text-[10px] tracking-wider",
                  // Last slide swaps to amber — the celebration moment.
                  isLast
                    ? "bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f] hover:shadow-[0_2px_0_0_#78350f] active:shadow-[0_0_0_0_#78350f]"
                    : "bg-indigo-500 text-white shadow-[0_4px_0_0_#312e81] hover:shadow-[0_2px_0_0_#312e81] active:shadow-[0_0_0_0_#312e81]",
                  "hover:translate-y-0.5 active:translate-y-1",
                  "transition-transform duration-100 pixel-focus outline-none",
                  "disabled:opacity-50"
                )}
              >
                {isLast ? (
                  <>
                    <Swords className="w-3.5 h-3.5" aria-hidden />
                    ENTER THE REALM
                  </>
                ) : (
                  <>
                    NEXT
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Slide content ───────────────────────────────────────────────────────────
// Loremaster voice — same vocabulary as the rest of the app (trial, quest,
// ascend). Slide 2 visualises the pipeline in one row of icons so users
// don't have to read the steps. Slide 3 is the celebration tap.

interface Slide {
  icon: React.ReactNode;
  microLabel: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: <GraduationCap className="w-12 h-12 text-indigo-300" aria-hidden />,
    microLabel: "WELCOME",
    title: "Welcome, Adventurer",
    body: "StudyQuest turns your study material into an academic RPG. Every chapter becomes a quest. Every quiz earns XP. Every topic mastered is a victory.",
  },
  {
    icon: (
      <div className="flex items-center gap-2 sm:gap-3" aria-hidden>
        <BookOpen className="w-8 h-8 text-indigo-400" />
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <Sparkles className="w-8 h-8 text-purple-400" />
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <Swords className="w-8 h-8 text-amber-400" />
      </div>
    ),
    microLabel: "HOW IT WORKS",
    title: "Three steps to mastery",
    body: "Upload a PDF. The AI extracts topics and generates trials. You answer, earn XP, master concepts, and slay episode bosses.",
  },
  {
    icon: <Swords className="w-12 h-12 text-amber-300" aria-hidden />,
    microLabel: "READY?",
    title: "Begin your quest",
    body: "Your courses are worlds. Your topics are trials. Your XP is real. The map is waiting.",
  },
];
