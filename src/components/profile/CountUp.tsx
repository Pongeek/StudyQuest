"use client";

// ─── CountUp ──────────────────────────────────────────────────────────────────
// Animates a number from 0 to its value on mount. Because inactive profile tab
// panels unmount, mounting === "tab became visible", so this plays on tab-in.
// The first-reveal-only guard (animate once per surface per page session, even
// across the tab unmount/remount) lives in the shared useFirstReveal hook.
// Reduced-motion shows the final value immediately.
//
// All props are serializable (no function props) so server components can render
// this directly with `mode` / `suffix` instead of a formatter callback.

import { useEffect, useRef, useState } from "react";
import { useFirstReveal } from "@/lib/useFirstReveal";

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
  const { settled, markRevealed } = useFirstReveal(animKey);
  const [display, setDisplay] = useState(() => (settled() ? value : 0));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Instant path (reduced-motion or already animated this session): jump to
    // the value on the next frame — never set state synchronously in the effect.
    if (settled()) {
      rafRef.current = requestAnimationFrame(() => setDisplay(value));
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    markRevealed();
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
  }, [value, durationMs, settled, markRevealed]);

  const n = Math.round(display);
  const text = mode === "duration" ? formatDuration(n) : n.toLocaleString();
  return <span className={className}>{text}{suffix}</span>;
}
