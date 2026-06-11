"use client";

// ─── LandingQuestPath ────────────────────────────────────────────────────────
// A thin vertical "quest line" pinned to the left edge of the viewport. The
// line draws itself top-to-bottom as the user scrolls the landing page;
// section "nodes" (small diamond marks) glow amber when the user is within
// that section's scroll range.
//
// Each node watches its own threshold crossing on the spring-smoothed scroll
// progress. Crossing the threshold:
//   - going DOWN  (turning ON):  amber ring expands outward, fades — small delay
//   - going UP    (turning OFF): indigo ring starts big, contracts inward, fades — small delay
//
// Pure decorative chrome — pointer-events disabled, hidden on small screens
// where it would compete with content.

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

const NODES: Array<{ at: number; label: string }> = [
  { at: 0.00, label: "Hero" },
  { at: 0.12, label: "Forge" },
  { at: 0.34, label: "Trial" },
  { at: 0.52, label: "Boss" },
  { at: 0.72, label: "Arsenal" },
  { at: 0.82, label: "Mockups" },
  { at: 0.90, label: "Compare" },
  { at: 0.96, label: "Begin" },
];

const ACTIVE_WINDOW = 0.06; // ±% around each node where it's considered "active"

export default function LandingQuestPath() {
  const { scrollYProgress } = useScroll();

  // Spring-smoothed progress so the line eases instead of jittering
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    restDelta: 0.001,
  });

  return (
    <div
      aria-hidden
      className="fixed left-4 lg:left-6 top-0 bottom-0 z-20 hidden lg:flex items-center pointer-events-none"
    >
      <div className="relative h-[70vh] w-6 flex flex-col items-center">
        {/* Background track (dim) */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-indigo-500/15" />

        {/* Active progress fill — amber→indigo gradient */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-px origin-top"
          style={{
            height: "100%",
            background:
              "linear-gradient(to bottom, #f59e0b 0%, #f59e0b 20%, #6366f1 70%, #312e81 100%)",
            scaleY: smoothProgress,
            boxShadow:
              "0 0 8px rgba(245,158,11,0.35), 0 0 16px rgba(99,102,241,0.18)",
          }}
        />

        {/* Section nodes — pixel-art diamonds that pulse amber when active */}
        {NODES.map((node, i) => (
          <NodeMarker key={i} at={node.at} smoothProgress={smoothProgress} />
        ))}
      </div>
    </div>
  );
}

// ─── NodeMarker ──────────────────────────────────────────────────────────────

interface NodeMarkerProps {
  at: number;
  smoothProgress: ReturnType<typeof useSpring>;
}

type RippleDir = "forward" | "reverse";

function NodeMarker({ at, smoothProgress }: NodeMarkerProps) {
  // Glow intensity peaks when scroll is at `at`, fades out beyond ACTIVE_WINDOW
  const glow = useTransform(
    smoothProgress,
    [at - ACTIVE_WINDOW, at, at + ACTIVE_WINDOW],
    [0, 1, 0]
  );

  // 1 once we've passed this node, 0 before (drives the "color filled" look)
  const reached = useTransform(smoothProgress, [at - 0.005, at + 0.005], [0, 1]);

  // Background color interpolates from dark indigo (unreached) to amber (reached)
  const bg = useTransform(reached, [0, 1], ["#1e1b4b", "#f59e0b"]);

  // Scale up briefly while active
  const scale = useTransform(glow, [0, 1], [1, 1.6]);

  // ── Crossing-triggered ripple ─────────────────────────────────────────────
  // Watch this node's own threshold (`at`) on the smoothed scroll. When the
  // user crosses it going down → forward ripple; going up → reverse ripple.
  // seq increments so consecutive crossings on the same node re-trigger the
  // AnimatePresence mount.
  const [ripple, setRipple] = useState<{ dir: RippleDir; seq: number } | null>(null);
  const prevRef = useRef<number>(at + 1); // sentinel so we don't fire on first measurement
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize prevRef on mount with the actual progress
  useEffect(() => {
    prevRef.current = smoothProgress.get();
  }, [smoothProgress]);

  useMotionValueEvent(smoothProgress, "change", (current) => {
    const previous = prevRef.current;
    prevRef.current = current;

    let dir: RippleDir | null = null;
    if (previous < at && current >= at) dir = "forward";
    else if (previous > at && current <= at) dir = "reverse";
    if (!dir) return;

    seqRef.current += 1;
    setRipple({ dir, seq: seqRef.current });
    if (timerRef.current) clearTimeout(timerRef.current);
    // Animation total = 150ms delay + 1.3s = 1.45s; clear shortly after.
    timerRef.current = setTimeout(() => setRipple(null), 1500);
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <motion.div
      className="absolute left-1/2 -translate-x-1/2"
      style={{ top: `${at * 100}%`, marginTop: -4 }}
    >
      {/* Outer glow halo — always present, intensifies while active */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          width: 24,
          height: 24,
          left: -8,
          top: -8,
          background: "radial-gradient(circle, rgba(245,158,11,0.5), transparent 70%)",
          opacity: glow,
        }}
      />

      {/* Crossing ripple — direction-aware (amber out / indigo in) */}
      <AnimatePresence>
        {ripple && (
          <motion.div
            key={ripple.seq}
            className="absolute pointer-events-none"
            style={{
              width: 8,
              height: 8,
              left: 0,
              top: 0,
              borderRadius: 2,
              transform: "rotate(45deg)",
              border:
                ripple.dir === "forward"
                  ? "1px solid rgba(245,158,11,0.85)"
                  : "1px solid rgba(99,102,241,0.85)",
              boxShadow:
                ripple.dir === "forward"
                  ? "0 0 12px rgba(245,158,11,0.6)"
                  : "0 0 12px rgba(99,102,241,0.55)",
            }}
            initial={
              ripple.dir === "forward"
                ? { opacity: 0, scale: 1 }
                : { opacity: 0, scale: 4 }
            }
            animate={
              ripple.dir === "forward"
                ? { opacity: [0, 0.9, 0], scale: [1, 1, 4] }
                : { opacity: [0, 0.7, 0], scale: [4, 4, 1] }
            }
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.3,
              delay: 0.15,
              times: [0, 0.15, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        )}
      </AnimatePresence>

      {/* Diamond marker — 45° rotated square */}
      <motion.div
        className="relative"
        style={{
          width: 8,
          height: 8,
          background: bg,
          rotate: 45,
          scale,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
        }}
      />
    </motion.div>
  );
}
