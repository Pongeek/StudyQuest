"use client";

import FloatingParticles from "@/components/effects/FloatingParticles";

/**
 * Client-side ambient effects for the dashboard.
 *
 * Renders the floating-particle layer behind every authed screen. Kept as a
 * thin client wrapper so the dashboard layout can stay a Server Component
 * without importing the canvas-based particle effect directly.
 */
export default function DashboardAnimations() {
  return <FloatingParticles count={35} hue={240} />;
}
