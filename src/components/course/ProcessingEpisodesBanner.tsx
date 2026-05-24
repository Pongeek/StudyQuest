"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingEpisode {
  id: string;
  title: string;
  /** ISO timestamp when the episode row was created (the start of processing). */
  startedAt: string;
}

interface ProcessingEpisodesBannerProps {
  episodes: ProcessingEpisode[];
}

/**
 * Visible status surface for episodes currently being processed by the AI.
 *
 * Sits above the CourseMap on the course detail page. Without this card,
 * a processing episode renders inside CourseMap with no topics (because
 * extraction hasn't finished), reading as a broken empty card. Pulling
 * them out into this dedicated banner makes "AI is working" the loud,
 * unmistakable thing on the page while extraction is in flight.
 *
 * Each row shows the episode title and an elapsed-time counter that
 * ticks every second on the client. The counter is the only client-state
 * thing — everything else is plain layout. Pulled from a hook on mount
 * so the timer starts at the actual elapsed time (not zero), in case
 * the user refreshed the page mid-processing.
 *
 * Auto-disappears when the parent's `episodes` prop becomes empty —
 * `EpisodeProcessingPoller` will have re-rendered the page by then with
 * the episode now in `status: "ready"`.
 */
export default function ProcessingEpisodesBanner({
  episodes,
}: ProcessingEpisodesBannerProps) {
  if (episodes.length === 0) return null;

  const headline =
    episodes.length === 1
      ? "AI is forging your episode"
      : `AI is forging ${episodes.length} episodes`;

  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className="relative bg-slate-900/95 pixel-border text-amber-500/80 px-5 py-5 sm:px-6 sm:py-6"
    >
      {/* Pixel nail corners — amber to read as "in progress" */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 z-[2]" />

      <div className="relative z-[1]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 pixel-border bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="font-pixel text-[9px] tracking-wider text-amber-300/90 mb-1">
              EXTRACTION IN PROGRESS
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">{headline}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Topics and quizzes are being generated. Usually 30–90 seconds.
            </p>
          </div>
        </div>

        {/* Per-episode rows */}
        <ul className="space-y-2">
          {episodes.map((ep) => (
            <ProcessingRow key={ep.id} title={ep.title} startedAt={ep.startedAt} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProcessingRow({
  title,
  startedAt,
}: {
  title: string;
  startedAt: string;
}) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  );

  // Tick once per second. Caps at 5 min — after that the poller will have
  // stopped and the user should refresh manually.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec((s) => Math.min(s + 1, 5 * 60));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <li className="flex items-center gap-3 bg-slate-800/40 px-3 py-2.5">
      <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" aria-hidden />
      <span className="text-sm text-slate-200 truncate flex-1">{title}</span>
      <span
        className={cn(
          "font-pixel text-[9px] tracking-wider text-amber-300/80 tabular-nums flex-shrink-0",
          // Subtle warning shading past 2 minutes so the user knows it's
          // taking longer than typical but not panic-worthy.
          elapsedSec > 120 && "text-amber-200"
        )}
      >
        {formatElapsed(elapsedSec)}
      </span>
    </li>
  );
}

function formatElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem.toString().padStart(2, "0")}s`;
}
