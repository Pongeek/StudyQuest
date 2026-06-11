"use client";

// ─── scrub.ts ────────────────────────────────────────────────────────────────
// Shared CSS-var scroll-scrub helpers for the landing page.
//
// Architecture: framer-motion useScroll/useTransform style subscriptions
// silently die under React 19 + Turbopack dev (see the CLAUDE.md gotcha), so
// every scroll-scrubbed visual is driven by ONE custom property (--p, 0→1)
// written by a plain scroll listener, and consumed by pure CSS calc()/clamp()
// expressions built with `r` (ramp) and `win` (window). No animation-library
// subscriptions to lose.

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** CSS expression: 0→1 ramp as var(--p) moves a→b (clamped). */
export const r = (a: number, b: number) =>
  `clamp(0, (var(--p) - ${a}) / ${b - a}, 1)`;

/** CSS expression: 0→1→0 window (rise a→b, fall c→d). Parenthesized. */
export const win = (a: number, b: number, c: number, d: number) =>
  `(${r(a, b)} * (1 - ${r(c, d)}))`;

// ─── prefers-reduced-motion ──────────────────────────────────────────────────

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

export function useReducedMotionPref() {
  // SSR renders the scrubbed version; client swaps to the static treatment if
  // the user prefers reduced motion (server snapshot is false).
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}

// ─── scrub drivers ───────────────────────────────────────────────────────────

/**
 * Sticky-chapter scrub: tracks scroll progress (0→1) through wrapRef (the
 * tall wrapper) and writes it as `--p` on stageRef (the sticky stage).
 * `onFrame` (module-level fn — must be referentially stable) gets the same
 * value for text-counter updates.
 */
export function useStageScrub(onFrame?: (p: number, stage: HTMLDivElement) => void) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = wrap.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const p = scrollable > 0 ? clamp01(-rect.top / scrollable) : 0;
      stage.style.setProperty("--p", p.toFixed(5));
      onFrame?.(p, stage);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [onFrame]);

  return { wrapRef, stageRef };
}

/**
 * In-flow section scrub: writes `--p` on the element itself, computed by
 * `compute(rect, viewportHeight)` — e.g. entry progress as the section rises
 * into view, or exit progress as it leaves. `compute` must be module-level
 * (referentially stable). `disabled` pins --p to 1 (reduced motion).
 */
export function useScrubOn(
  ref: RefObject<HTMLElement | null>,
  compute: (rect: DOMRect, vh: number) => number,
  disabled = false,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (disabled) {
      el.style.setProperty("--p", "1");
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const p = clamp01(compute(el.getBoundingClientRect(), window.innerHeight));
      el.style.setProperty("--p", p.toFixed(5));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, compute, disabled]);
}

// ─── pixel shards ────────────────────────────────────────────────────────────

export interface Shard {
  left: number;
  top: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  rot: number;
  tone: string;
}

/**
 * Deterministic pixel-shard grid (SSR-safe, no Math.random). Consumers drive
 * the field with a `--d` custom property: 0 = assembled in place, 1 = fully
 * scattered. The canonical shard span style is:
 *   transform: translate(calc(var(--d) * DXpx), calc(var(--d) * DYpx))
 *              rotate(calc(var(--d) * ROTdeg)) scale(calc(1 - var(--d) * 0.6))
 *   opacity:   calc(clamp(0, var(--d) * 14, 1) * (0.95 - var(--d)))
 * which is invisible at both extremes and visible mid-flight — so the same
 * field works for disintegration (--d: 0→1) AND assembly (--d: 1→0).
 */
export function makeShards(cols: number, rows: number): Shard[] {
  return Array.from({ length: cols * rows }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const r1 = ((i * 73 + 11) % 17) / 17 - 0.5;
    const r2 = ((i * 31 + 5) % 13) / 13 - 0.5;
    const r3 = ((i * 47 + 3) % 11) / 11 - 0.5;
    const tone =
      i % 9 === 0 ? "bg-amber-400/80" : i % 4 === 0 ? "bg-indigo-400/80" : "bg-slate-600/80";
    return {
      left: (col / cols) * 100,
      top: (row / rows) * 100,
      w: 100 / cols,
      h: 100 / rows,
      dx: Math.round(r1 * 320),
      dy: Math.round(r2 * 260 - 80),
      rot: Math.round(r3 * 220),
      tone,
    };
  });
}
