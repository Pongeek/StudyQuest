"use client";

interface AuroraBackgroundProps {
  className?: string;
}

/**
 * Animated aurora orbs — four slow-drifting radial gradient blobs that
 * replace the canvas-based FloatingParticles. Pure CSS transforms/opacity
 * keep animation on the GPU compositor thread. prefers-reduced-motion is
 * handled in globals.css via the @media rule on .aurora-orb.
 */
export default function AuroraBackground({ className = "" }: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      {/* Indigo — top-right, largest, primary quest color */}
      <div className="aurora-orb aurora-orb-indigo animate-aurora-1" />
      {/* Violet — bottom-left, mystery/grimoire color */}
      <div className="aurora-orb aurora-orb-violet animate-aurora-2" />
      {/* Purple — center-screen, magic/epic reward color */}
      <div className="aurora-orb aurora-orb-purple animate-aurora-3" />
      {/* Amber — upper-left, XP/gold accent — very subtle warm note */}
      <div className="aurora-orb aurora-orb-amber animate-aurora-4" />
    </div>
  );
}
