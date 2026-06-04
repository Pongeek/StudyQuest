"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { getOverlayCopy, type OverlayKind } from "@/lib/loading-copy";

/** @deprecated use {@link OverlayKind} from `@/lib/loading-copy`. */
export type GradingOverlayKind = OverlayKind;

interface GradingOverlayProps {
  /** Mount + visibility flag. Drives both presence and the cycle timer. */
  show: boolean;
  /** Controls which flavor messages cycle below the sigil. */
  kind?: OverlayKind;
  /** Optional override for the pixel-font title. */
  title?: string;
  /** Optional override for the cycling messages. Takes precedence over `kind`. */
  messages?: string[];
}

/**
 * Full-screen overlay shown during AI-grading waits (quiz/exam/boss complete,
 * Feynman evaluation, etc.). Communicates two things to the user:
 *   1. The app is not stuck — there's an active, lively animation
 *   2. Something specific is happening — cycling messages name the AI's job
 *
 * Pure presentation — the parent controls when to mount/unmount via `show`.
 */
export default function GradingOverlay({
  show,
  kind = "generic",
  title: titleOverride,
  messages: messagesOverride,
}: GradingOverlayProps) {
  const { title: defaultTitle, messages: defaultMessages } = getOverlayCopy(kind);
  const messages = messagesOverride ?? defaultMessages;
  const title = titleOverride ?? defaultTitle;

  // Cycle through messages every ~2.6s while visible. Reset when overlay
  // re-opens so the user always starts at message 0.
  const [messageIdx, setMessageIdx] = useState(0);

  useEffect(() => {
    if (!show) {
      setMessageIdx(0);
      return;
    }
    const id = setInterval(() => {
      setMessageIdx((i) => (i + 1) % messages.length);
    }, 2600);
    return () => clearInterval(id);
  }, [show, messages.length]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="grading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/88 backdrop-blur-md px-6"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-center max-w-md"
          >
            {/* Animated sigil */}
            <div className="grading-orb-stage" aria-hidden="true">
              <div className="grading-orb-halo" />
              <div className="grading-ring grading-ring-outer" />
              <div className="grading-ring grading-ring-mid" />
              <div className="grading-ring grading-ring-inner" />

              {/* Orbital particles — two layers, counter-rotating */}
              <div className="grading-particle-wrap">
                <div className="grading-particle" />
              </div>
              <div className="grading-particle-wrap grading-particle-wrap--reverse">
                <div className="grading-particle grading-particle--indigo" />
              </div>

              {/* Center orb — separately centered via flex so its pulse
                  animation doesn't conflict with a translate transform. */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grading-orb-core" />
              </div>
            </div>

            {/* Pixel title */}
            <h2 className="font-pixel text-[11px] sm:text-[13px] tracking-[0.22em] text-amber-400 mt-8 mb-4 uppercase">
              {title}
            </h2>

            {/* Cycling flavor text */}
            <div className="h-7 sm:h-8 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={messageIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}
                  className="text-slate-300 text-sm sm:text-base leading-relaxed"
                >
                  {messages[messageIdx]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Subtle reassurance */}
            <p className="text-[11px] text-slate-500 mt-6 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400/60" aria-hidden="true" />
              This usually takes a few moments
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
