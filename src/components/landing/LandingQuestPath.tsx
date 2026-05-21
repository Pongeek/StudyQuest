"use client";

// ─── LandingQuestPath ────────────────────────────────────────────────────────
// A thin vertical "quest line" pinned to the left edge of the viewport. The
// line draws itself top-to-bottom as the user scrolls the landing page;
// section "nodes" (small diamond marks) glow amber when the user is within
// that section's scroll range.
//
// Pure decorative chrome — pointer-events disabled, hidden on small screens
// where it would compete with content.

import { motion, useScroll, useSpring, useTransform } from "framer-motion";

const NODES: Array<{ at: number; label: string }> = [
  { at: 0.00, label: "Hero" },
  { at: 0.13, label: "Arsenal" },
  { at: 0.26, label: "Demo" },
  { at: 0.40, label: "Mockups" },
  { at: 0.58, label: "Story" },
  { at: 0.82, label: "Compare" },
  { at: 0.94, label: "Begin" },
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

  return (
    <motion.div
      className="absolute left-1/2 -translate-x-1/2"
      style={{ top: `${at * 100}%`, marginTop: -4 }}
    >
      {/* Outer glow halo */}
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
