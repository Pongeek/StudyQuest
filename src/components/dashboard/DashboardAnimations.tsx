"use client";

import AnimatedRPGBackground from "@/components/effects/AnimatedRPGBackground";

/**
 * Dashboard atmosphere layer — variant 1.
 *
 * Three mouse-tracking gradient blobs (indigo / purple / amber), a violet
 * constellation canvas, a 600px cursor spotlight, edge accent lines, and
 * a slow-breathing gridline overlay. All contained in a single fixed z-0
 * wrapper so it never beats the layout's z-10 main content.
 *
 * The previous AuroraBackground orbs aren't needed here — variant 1 has
 * its own blob system that replaces them. AuroraBackground is still used
 * on the public landing page.
 */
export default function DashboardAnimations() {
  return <AnimatedRPGBackground />;
}
