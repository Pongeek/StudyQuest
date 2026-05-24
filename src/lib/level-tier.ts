/**
 * Level tier visuals — drives the progressive rank chrome on every
 * level-display surface (dashboard hero frame, nav HUD chip, profile
 * level identity, LevelBadge in overlays/boss).
 *
 * Tier identity (color + frame + decoration) changes at the 6 boundaries
 * defined by LEVEL_TIERS in lib/xp.ts. Within a tier, two cosmetic
 * "drift" axes shift smoothly so each individual level still feels
 * distinct: saturation and glow alpha.
 *
 * Pure function — no React, no DOM, no DB. Components read the returned
 * object and pick CSS class names / inline CSS custom properties from it.
 */

import { LEVEL_TIERS, getLevelTitle } from "@/lib/xp";

export type TierName =
  | "novice"
  | "apprentice"
  | "adept"
  | "expert"
  | "master"
  | "sage";

export type TierDecoration =
  | "none"
  | "sparks"   // Apprentice: 4 small corner pixels accent
  | "laurel"   // Adept: side laurel marks flanking the frame
  | "crown"    // Expert: 3-tooth pixel crown atop the frame
  | "flames"   // Master: flame-edge corner ornaments + scanlines
  | "runes";   // Sage: animated 4-rune ring + scanlines + gradient

export type TierGlow =
  | "none"
  | "pulse"     // soft heartbeat
  | "halo"      // steady halo with slow pulse
  | "breathe"   // slow warm breathing
  | "breathe-strong" // breathe + extra outer halo
  | "ring";     // rotating particle/rune ring

export interface LevelTierVisuals {
  /** Stable enum identifier — drives className lookups. */
  tier: TierName;
  /** Human-readable title from LEVEL_TIERS (Novice / Apprentice / …). */
  tierTitle: string;
  /** Min / max level for the tier (inclusive). Useful for "lv X of N in tier" UI. */
  tierMin: number;
  tierMax: number;
  /** Sub-tier progress 0–1: 0 at tier.min, 1 at tier.max. Open-ended
   *  tiers (Sage) saturate at 1.0 after a soft ramp. */
  subTierProgress: number;
  /** 0.00–0.25 — how much extra HSL saturation to add over the base
   *  tier color across the tier range. Component sets this as a CSS
   *  custom property so a single utility class can render the drift. */
  saturationOffset: number;
  /** 0.40–0.65 — outer glow alpha for the tier accent. */
  glowAlpha: number;
  /** Lucide-ish decoration kind. "none" for Novice; layered ornaments for higher tiers. */
  decoration: TierDecoration;
  /** Glow style for the frame's ambient pulse. */
  glow: TierGlow;
  /** className applied to the level frame to pull tier-specific tokens
   *  (border color, nail color, scanlines toggle, numeral color). */
  tierClass: string;
}

// Glow + saturation drift floors. The base values had to be raised because
// the original 0.40 alpha was too subtle to register as "tier identity"
// at small frame sizes — tier color was technically applied but the user
// couldn't tell tiers apart visually. Floor at 0.55 keeps Novice readable
// while leaving Sage room to dominate.
const SATURATION_BASE = 0;
const SATURATION_SPREAD = 0.25;
const GLOW_ALPHA_BASE = 0.55;
const GLOW_ALPHA_SPREAD = 0.30;

const TIER_NAME_BY_TITLE: Record<string, TierName> = {
  Novice: "novice",
  Apprentice: "apprentice",
  Adept: "adept",
  Expert: "expert",
  Master: "master",
  Sage: "sage",
};

const DECORATION_BY_TIER: Record<TierName, TierDecoration> = {
  novice: "none",
  apprentice: "sparks",
  adept: "laurel",
  expert: "crown",
  master: "flames",
  sage: "runes",
};

const GLOW_BY_TIER: Record<TierName, TierGlow> = {
  novice: "none",
  apprentice: "pulse",
  adept: "halo",
  expert: "breathe",
  master: "breathe-strong",
  sage: "ring",
};

/**
 * Open-ended tier (Sage, max=Infinity) needs a finite reference point for
 * subTierProgress. We treat 50 levels above the tier's min as "fully
 * filled" — beyond that the user has clearly earned the maxed-out look.
 */
const OPEN_TIER_VIRTUAL_SPAN = 50;

export function getLevelTierVisuals(level: number): LevelTierVisuals {
  const tierEntry =
    LEVEL_TIERS.find((t) => level >= t.min && level <= t.max) ?? LEVEL_TIERS[0];
  const tierName: TierName =
    TIER_NAME_BY_TITLE[tierEntry.title] ?? "novice";

  const span = Number.isFinite(tierEntry.max)
    ? Math.max(1, tierEntry.max - tierEntry.min)
    : OPEN_TIER_VIRTUAL_SPAN;

  const rawProgress = (level - tierEntry.min) / span;
  const subTierProgress = Math.max(0, Math.min(1, rawProgress));

  return {
    tier: tierName,
    tierTitle: tierEntry.title,
    tierMin: tierEntry.min,
    tierMax: Number.isFinite(tierEntry.max) ? tierEntry.max : tierEntry.min + OPEN_TIER_VIRTUAL_SPAN,
    subTierProgress,
    saturationOffset: SATURATION_BASE + SATURATION_SPREAD * subTierProgress,
    glowAlpha: GLOW_ALPHA_BASE + GLOW_ALPHA_SPREAD * subTierProgress,
    decoration: DECORATION_BY_TIER[tierName],
    glow: GLOW_BY_TIER[tierName],
    tierClass: `tier-${tierName}`,
  };
}

/**
 * True iff `prevLevel` and `newLevel` belong to different tiers. Used by
 * LevelUpOverlay to fire the larger RANK UP celebration variant only on
 * the boundary crossings (not on every level-up within a tier).
 */
export function isTierUp(prevLevel: number, newLevel: number): boolean {
  return getLevelTierVisuals(prevLevel).tier !== getLevelTierVisuals(newLevel).tier;
}

/** Friendly title lookup (re-exports xp.ts helper for ergonomics). */
export { getLevelTitle };

// ─────────────────────────────────────────────────────────────────────────
// Nav HUD chip color tokens — secondary surface (every-page level reminder).
// The chip is too small for decorations, but the accent color must track
// the tier so the hero frame and the nav chip read as one identity.
// ─────────────────────────────────────────────────────────────────────────

export interface TierNavChipColors {
  bgClass: string;
  textClass: string;
  /** Stroke color for the active mastery-ring arc on the chip. */
  ringStroke: string;
  /** Stroke color for the unfilled track behind the arc. */
  ringStrokeBg: string;
  /** Icon (Shield) tint inside the ring. */
  iconClass: string;
}

const TIER_CHIP_COLORS: Record<TierName, TierNavChipColors> = {
  novice: {
    bgClass: "bg-slate-500/10",
    textClass: "text-slate-200",
    ringStroke: "#cbd5e1",
    ringStrokeBg: "rgba(148,163,184,0.25)",
    iconClass: "text-slate-200",
  },
  apprentice: {
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-300",
    ringStroke: "#fbbf24",
    ringStrokeBg: "rgba(245,158,11,0.28)",
    iconClass: "text-amber-300",
  },
  adept: {
    // Stitch picked cyan-400 (more vivid than sky). Chip follows suit.
    bgClass: "bg-cyan-500/10",
    textClass: "text-cyan-300",
    ringStroke: "#22d3ee",
    ringStrokeBg: "rgba(34,211,238,0.28)",
    iconClass: "text-cyan-300",
  },
  expert: {
    // Stitch picked ORANGE (not yellow) for Expert — chip follows.
    bgClass: "bg-orange-500/10",
    textClass: "text-orange-300",
    ringStroke: "#fb923c",
    ringStrokeBg: "rgba(249,115,22,0.28)",
    iconClass: "text-orange-300",
  },
  master: {
    bgClass: "bg-purple-500/10",
    textClass: "text-purple-300",
    ringStroke: "#c084fc",
    ringStrokeBg: "rgba(168,85,247,0.28)",
    iconClass: "text-purple-300",
  },
  sage: {
    // Sage's hero frame uses the amber→pink→violet gradient — the chip
    // can't render a gradient ring stroke easily, so it picks PINK (the
    // gradient's bridge color) as the chip's mono accent.
    bgClass: "bg-pink-500/10",
    textClass: "text-pink-300",
    ringStroke: "#f9a8d4",
    ringStrokeBg: "rgba(236,72,153,0.32)",
    iconClass: "text-pink-300",
  },
};

export function getTierNavChipColors(tier: TierName): TierNavChipColors {
  return TIER_CHIP_COLORS[tier];
}
