"use client";

// ─── CountUp ──────────────────────────────────────────────────────────────────
// Animates a number from 0 to its value on mount. Because inactive profile tab
// panels unmount, mounting === "tab became visible", so this plays on tab-in.
// A module-level guard keyed by `animKey` makes it animate only the FIRST time a
// surface is revealed per page session (it survives the unmount/remount), so
// re-entering a tab doesn't re-animate. Reduced-motion shows the final value
// immediately.
//
// All props are serializable (no function props) so server components can render
// this directly with `mode` / `suffix` instead of a formatter callback.

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const animatedKeys = new Set<string>();

interface Props {
  value: number;
  /** Stable id — animates once per page session per surface. */
  animKey: string;
  /** "int" → locale integer; "duration" → minutes as "Xh Ym". */
  mode?: "int" | "duration";
  suffix?: string;
  durationMs?: number;
  className?: string;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function CountUp({
  value,
  animKey,
  mode = "int",
  suffix = "",
  durationMs = 700,
  className,
}: Props) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(() =>
    reduce || animatedKeys.has(animKey) ? value : 0
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Instant path (reduced-motion or already animated this session): jump to
    // the value on the next frame — never set state synchronously in the effect.
    if (reduce || animatedKeys.has(animKey)) {
      rafRef.current = requestAnimationFrame(() => setDisplay(value));
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    animatedKeys.add(animKey);
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(value * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(value);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, animKey, durationMs, reduce]);

  const n = Math.round(display);
  const text = mode === "duration" ? formatDuration(n) : n.toLocaleString();
  return <span className={className}>{text}{suffix}</span>;
}
