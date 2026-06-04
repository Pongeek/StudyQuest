"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useSound } from "@/lib/useSound";
import AchievementUnlockOverlay, {
  type UnlockedAchievement,
} from "@/components/effects/AchievementUnlockOverlay";
import { INLINE_COPY } from "@/lib/loading-copy";

interface ScrollData {
  id: string;
  content: string;
  topicTitle: string;
  courseTitle: string;
  dismissed: boolean;
}

/** True when the text contains Hebrew/Arabic characters — drives dir="rtl". */
function isRTL(text: string): boolean {
  return /[֐-׿؀-ۿ]/.test(text);
}

function getLocalStorageKey(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `sq:scroll-${today}`;
}

export default function ScrollOfWisdom() {
  const [scroll, setScroll] = useState<ScrollData | null>(null);
  const [show, setShow] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [pendingAchievements, setPendingAchievements] = useState<UnlockedAchievement[]>([]);
  const { play } = useSound();

  useEffect(() => {
    // If already dismissed today via localStorage, skip the fetch entirely
    if (typeof window !== "undefined" && localStorage.getItem(getLocalStorageKey()) === "1") {
      return;
    }

    let cancelled = false;

    // Phase 1 — peek: does today's scroll already exist, is one coming, or
    // nothing at all? Never triggers the AI call.
    fetch("/api/scroll/today")
      .then((r) => r.json())
      .then((data: Partial<ScrollData> & { pending?: boolean }) => {
        if (cancelled) return;

        // A cached scroll already exists for today.
        if (data.content) {
          if (data.dismissed) {
            // Server says it was already dismissed — sync localStorage and skip
            if (typeof window !== "undefined") {
              localStorage.setItem(getLocalStorageKey(), "1");
            }
            return;
          }
          setScroll(data as ScrollData);
          setShow(true);
          return;
        }

        // A scroll can be generated — show the loading modal, then Phase 2
        // (generate) fills it in. Guarded so users with no scroll coming never
        // see a flash.
        if (data.pending) {
          setShow(true);
          fetch("/api/scroll/today?generate=1")
            .then((r) => r.json())
            .then((gen: Partial<ScrollData>) => {
              if (cancelled) return;
              if (!gen.content) {
                // AI failed or the topic vanished — hide gracefully
                setShow(false);
                return;
              }
              setScroll(gen as ScrollData);
            })
            .catch(() => {
              if (!cancelled) setShow(false);
            });
          return;
        }

        // Nothing to show (no ready courses) — skip silently
      })
      .catch(() => {
        // Network error — skip silently, never break the dashboard
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Play the reveal flourish when the actual insight appears — not during the
  // loading phase.
  useEffect(() => {
    if (show && scroll) {
      play("achievement");
    }
  }, [show, scroll, play]);

  const handleDismiss = async () => {
    if (dismissing) return;
    setDismissing(true);

    // Optimistically hide
    setShow(false);

    // Set localStorage so it never shows again today
    if (typeof window !== "undefined") {
      localStorage.setItem(getLocalStorageKey(), "1");
    }

    // Persist dismissal to server — also check for new achievements
    try {
      const res = await fetch("/api/scroll/today", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.newAchievements) && data.newAchievements.length > 0) {
          setPendingAchievements(data.newAchievements);
        }
      }
    } catch {
      // Ignore — localStorage is the primary gate
    }
  };

  return (
    <>
      {/* Achievement overlay — appears after scroll is dismissed */}
      {pendingAchievements.length > 0 && (
        <AchievementUnlockOverlay
          achievements={pendingAchievements}
          onAllDismissed={() => setPendingAchievements([])}
        />
      )}

    <AnimatePresence>
      {show && (
        // Backdrop — overflow-y-auto + py-8 so tall content scrolls instead of clipping.
        // Tap-to-dismiss is disabled while the insight is still being unrolled.
        <motion.div
          key="scroll-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[130] flex items-start justify-center bg-slate-950/85 backdrop-blur-md px-4 py-8 overflow-y-auto"
          onClick={scroll ? handleDismiss : undefined}
        >
          {/* Card — stop propagation so clicking the card itself doesn't dismiss.
              my-auto centers it vertically when the content is shorter than the viewport. */}
          <motion.div
            key="scroll-card"
            initial={{ scaleY: 0.05, opacity: 0, y: -20 }}
            animate={{ scaleY: 1, opacity: 1, y: 0 }}
            exit={{ scaleY: 0.05, opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 16, stiffness: 180 }}
            style={{ transformOrigin: "top" }}
            className="relative w-full max-w-lg my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Parchment-style card */}
            <div className="relative rpg-card-gold rounded-2xl p-8 sm:p-10 flex flex-col gap-6 text-center shadow-2xl border border-amber-500/30">

              {/* Amber pixel "scroll pins" at corners — subtle pixel-art accent
                  that ties the parchment to the rest of the app's pixel chrome
                  without breaking the medieval/scroll aesthetic. */}
              <span aria-hidden className="absolute top-2 left-2 w-1.5 h-1.5 bg-amber-400" />
              <span aria-hidden className="absolute top-2 right-2 w-1.5 h-1.5 bg-amber-400" />
              <span aria-hidden className="absolute bottom-2 left-2 w-1.5 h-1.5 bg-amber-400" />
              <span aria-hidden className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-amber-400" />

              {/* Decorative top ornament */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-amber-500/80" />
                <span className="text-amber-400 text-2xl">📜</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-500/50 to-amber-500/80" />
              </div>

              {/* Title */}
              <div>
                <p
                  className="text-amber-400 text-xs tracking-widest uppercase mb-1"
                  style={{ fontFamily: "var(--font-pixel, monospace)" }}
                >
                  Scroll of Wisdom
                </p>
                <p className="text-slate-400 text-xs">
                  Your daily insight
                </p>
              </div>

              {scroll ? (
                <>
                  {/* Insight text — dir + plaintext bidi so Hebrew/English mix renders correctly */}
                  <blockquote
                    dir={isRTL(scroll.content) ? "rtl" : "ltr"}
                    className="text-slate-100 text-base sm:text-lg leading-relaxed italic px-2"
                    style={{ unicodeBidi: "plaintext" }}
                  >
                    &ldquo;{scroll.content}&rdquo;
                  </blockquote>

                  {/* Attribution */}
                  <p className="text-slate-500 text-xs">
                    From{" "}
                    <span className="text-amber-400/80 not-italic font-medium">
                      {scroll.topicTitle}
                    </span>
                    {scroll.courseTitle && (
                      <>
                        {" · "}
                        <span className="text-slate-400">{scroll.courseTitle}</span>
                      </>
                    )}
                  </p>

                  {/* Decorative bottom ornament */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-amber-500/50" />
                    <span className="text-amber-500/40 text-xs">✦ ✦ ✦</span>
                    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-500/30 to-amber-500/50" />
                  </div>

                  {/* Dismiss button — chunky amber pixel-shadow CTA matching the
                      rest of the dashboard's pixel vocabulary. Keeps rounded edges
                      to harmonize with the parchment card's curved shape. */}
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.3 }}
                    onClick={handleDismiss}
                    disabled={dismissing}
                    className="mx-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg
                               font-pixel text-[10px] tracking-wider
                               bg-amber-500 text-slate-950 shadow-[0_4px_0_0_#78350f]
                               hover:shadow-[0_2px_0_0_#78350f] hover:translate-y-0.5
                               active:shadow-[0_0_0_0_#78350f] active:translate-y-1
                               disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[0_4px_0_0_#78350f]
                               transition-transform duration-100 pixel-focus outline-none"
                  >
                    SEAL THE SCROLL 🪄
                  </motion.button>

                  {/* Subtle hint */}
                  <p className="text-slate-600 text-xs -mt-2">
                    Tap anywhere to dismiss
                  </p>
                </>
              ) : (
                /* Loading phase — the insight is being unrolled. In-world Chrome
                   line + spinner, no dismiss affordance until content arrives. */
                <div
                  className="flex items-center justify-center gap-2.5 py-4 text-slate-400 text-sm"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="w-4 h-4 text-amber-400/70 animate-spin" aria-hidden />
                  {INLINE_COPY.scroll}
                </div>
              )}
            </div>

            {/* Ambient glow behind the card */}
            <div className="absolute inset-0 -z-10 rounded-2xl bg-amber-500/8 blur-2xl scale-110 pointer-events-none" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
