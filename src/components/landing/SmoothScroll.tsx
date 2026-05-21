"use client";

// ─── SmoothScroll ────────────────────────────────────────────────────────────
// Scoped Lenis smooth-scroll initializer for the landing page only. Mounted at
// the top of src/app/page.tsx; tears down cleanly on route change so the
// dashboard / authed pages aren't affected.

import { useEffect } from "react";
import Lenis from "lenis";

export default function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Honor reduced-motion users: cut the smoothing damping to near-zero.
      smoothWheel: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
