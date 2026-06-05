"use client";

// ─── ProgressFill ─────────────────────────────────────────────────────────────
// A progress-bar inner fill that grows from 0 to `pct` on mount via a CSS width
// transition. Same first-reveal-only semantics as CountUp (module-level guard
// keyed by animKey, surviving tab unmount/remount). Reduced-motion renders the
// final width with no transition.

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const filledKeys = new Set<string>();

interface Props {
  /** Target width percentage 0–100. */
  pct: number;
  animKey: string;
  className?: string;
}

export default function ProgressFill({ pct, animKey, className }: Props) {
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(() =>
    reduce || filledKeys.has(animKey) ? pct : 0
  );

  useEffect(() => {
    // Mark first reveal; either way we set the final width on the next frame so
    // the 0→pct change animates via the CSS transition (and state is never set
    // synchronously inside the effect body).
    if (!reduce) filledKeys.add(animKey);
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct, animKey, reduce]);

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
