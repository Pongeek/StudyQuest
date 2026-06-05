"use client";

// ─── ProgressFill ─────────────────────────────────────────────────────────────
// A progress-bar inner fill that grows from 0 to `pct` on mount via a CSS width
// transition. Same first-reveal-only semantics as CountUp via the shared
// useFirstReveal hook (animate once per surface per page session, surviving the
// tab unmount/remount). Reduced-motion renders the final width with no
// transition.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useFirstReveal } from "@/lib/useFirstReveal";

interface Props {
  /** Target width percentage 0–100. */
  pct: number;
  animKey: string;
  className?: string;
}

export default function ProgressFill({ pct, animKey, className }: Props) {
  const { settled, markRevealed } = useFirstReveal(animKey);
  const [width, setWidth] = useState(() => (settled() ? pct : 0));

  useEffect(() => {
    // Mark first reveal; either way we set the final width on the next frame so
    // the 0→pct change animates via the CSS transition (and state is never set
    // synchronously inside the effect body).
    markRevealed();
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct, markRevealed]);

  return (
    <div
      className={cn(
        "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out",
        className
      )}
      style={{ width: `${width}%` }}
    />
  );
}
