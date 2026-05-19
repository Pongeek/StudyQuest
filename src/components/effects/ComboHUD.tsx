"use client";

import { AnimatePresence, motion } from "framer-motion";

interface ComboHUDProps {
  /** Current consecutive-correct count. Renders nothing if < 2. */
  count: number;
}

/**
 * Floating combo HUD that appears when the player hits 2+ consecutive
 * correct answers.
 *
 * Positioned `fixed` to the viewport (bottom-right) so it never collides
 * with the question card's own header chips (e.g., the "Multiple Choice"
 * badge that lives in the same top-right region in RTL layouts).
 *
 * The combo bonus is currently client-side cosmetic only.
 * // TODO: wire combo bonus into server XP calculation
 */
export default function ComboHUD({ count }: ComboHUDProps) {
  return (
    <AnimatePresence>
      {count >= 2 && (
        <motion.div
          key={count}
          initial={{ opacity: 0, scale: 0.7, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ type: "spring", damping: 12, stiffness: 260 }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 select-none pointer-events-none"
          aria-live="polite"
          aria-label={`${count} consecutive correct answers`}
        >
          <div className="pixel-chip text-amber-400 bg-amber-500/15 flex-col items-center gap-0.5 px-3 py-2 backdrop-blur-md shadow-[0_4px_18px_-4px_rgba(245,158,11,0.45)]">
            {/* Flame + count */}
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none" aria-hidden>
                🔥
              </span>
              <span
                className="font-pixel text-[13px] text-amber-300 tabular-nums leading-none"
              >
                {count}×
              </span>
              <span className="font-pixel text-[8px] text-amber-400 uppercase tracking-wide leading-none">
                COMBO
              </span>
            </div>
            {/* Bonus sub-line */}
            <div className="text-[10px] text-amber-500 font-medium tracking-wide mt-1 text-center w-full">
              +{count * 15}% bonus
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
