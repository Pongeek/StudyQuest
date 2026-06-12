"use client";

import { Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import MarkdownContent from "@/components/quiz/MarkdownContent";

interface RuneCardFlipProps {
  front: string;
  back: string;
  topicTitle: string;
  flipped: boolean;
  onFlip: () => void;
  dir?: "ltr" | "rtl" | "auto";
}

/**
 * The drill card — CSS 3D flip (no framer; pure transform transition behind
 * motion-safe so reduced-motion gets an instant reveal). The whole card is
 * the tap target; Space/Enter are handled by the engine's keyboard layer.
 *
 * Gotcha guard: this subtree is TRANSFORMED — never render position:fixed
 * children inside it (they'd anchor to the card, not the viewport).
 */
export default function RuneCardFlip({
  front,
  back,
  topicTitle,
  flipped,
  onFlip,
  dir = "auto",
}: RuneCardFlipProps) {
  return (
    <div className="[perspective:1200px]">
      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Card answer shown" : "Reveal the answer"}
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFlip();
          }
        }}
        className={cn(
          "relative w-full min-h-[280px] sm:min-h-[300px] cursor-pointer select-none",
          "[transform-style:preserve-3d] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.4,0,0.2,1)]",
          flipped && "[transform:rotateY(180deg)]",
        )}
      >
        {/* Front — the prompt */}
        <div
          className={cn(
            "absolute inset-0 [backface-visibility:hidden] rounded-2xl overflow-hidden",
            "rpg-card border border-purple-500/25 flex flex-col",
          )}
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <span className="inline-flex items-center gap-1.5 font-pixel text-[8px] tracking-wider text-purple-300">
              <Gem className="w-3 h-3" />
              RUNE
            </span>
            <span className="text-[10px] text-slate-500 truncate max-w-[60%]">
              {topicTitle}
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center px-5 py-4 overflow-y-auto">
            <div dir={dir} className="text-base sm:text-lg text-slate-100 text-center max-w-prose">
              <MarkdownContent>{front}</MarkdownContent>
            </div>
          </div>
          <p className="px-4 pb-3 text-center text-[10px] text-slate-600">
            Tap or press Space to reveal
          </p>
        </div>

        {/* Back — the answer */}
        <div
          className={cn(
            "absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl overflow-hidden",
            "rpg-card border border-purple-500/25 flex flex-col",
          )}
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <span className="font-pixel text-[8px] tracking-wider text-purple-300/80">
              ANSWER
            </span>
            <span className="text-[10px] text-slate-500 truncate max-w-[60%]">
              {topicTitle}
            </span>
          </div>
          <div className="flex-1 px-5 py-4 overflow-y-auto">
            <div dir={dir} className="text-[11px] text-slate-500 mb-2">
              <span dir={dir} className="block">
                <MarkdownContent>{front}</MarkdownContent>
              </span>
            </div>
            <div className="h-px bg-purple-500/15 mb-3" />
            <div dir={dir} className="text-sm sm:text-base text-slate-200">
              <MarkdownContent>{back}</MarkdownContent>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
