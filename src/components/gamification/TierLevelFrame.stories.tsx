import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TierLevelFrame from "./TierLevelFrame";
import { getLevelTierVisuals } from "@/lib/level-tier";

const meta: Meta<typeof TierLevelFrame> = {
  title: "Gamification/TierLevelFrame",
  component: TierLevelFrame,
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark" },
    docs: {
      description: {
        component: `
The tier-aware HUD level frame. Pairs the existing \`.hud-level-frame\` chrome
with one of six tier palettes + decorations:

| Levels | Tier | Accent | Decoration | Glow |
| --- | --- | --- | --- | --- |
| 1–4 | Novice | slate | none | none |
| 5–9 | Apprentice | amber | corner sparks | soft pulse |
| 10–19 | Adept | sky/cyan | side laurel marks | halo |
| 20–34 | Expert | gold (yellow) | pixel crown | breathing |
| 35–49 | Master | violet | flame edges + scanlines | breathing strong |
| 50+ | Sage | violet + amber | rotating rune ring + scanlines | breathing + ring |

**Within-tier drift** — saturation and outer-glow alpha rise linearly across the tier range
(formula: \`subTierProgress = (level - tierMin) / (tierMax - tierMin)\`,
saturation +25% × progress, glowAlpha 0.40 → 0.65). Each individual level reads subtly
distinct without breaking tier identity.
        `,
      },
    },
  },
  argTypes: {
    level: {
      control: { type: "range", min: 1, max: 60, step: 1 },
      description: "Player level. Tier picked from LEVEL_TIERS in lib/xp.ts.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TierLevelFrame>;

// ── One-frame stories per tier ────────────────────────────────────────────

export const Novice: Story = {
  args: { level: 2 },
  parameters: {
    docs: { description: { story: "Plain slate frame. No decorations, no ambient glow." } },
  },
};

export const Apprentice: Story = {
  args: { level: 7 },
  parameters: {
    docs: { description: { story: "Amber identity (matches the existing XP/level color). Soft pulse + corner sparks." } },
  },
};

export const Adept: Story = {
  args: { level: 14 },
  parameters: {
    docs: { description: { story: "Cyan/sky scholarly identity. Side laurel marks flank the frame; steady halo glow." } },
  },
};

export const Expert: Story = {
  args: { level: 27 },
  parameters: {
    docs: { description: { story: "Gold (deeper amber). 3-tooth pixel crown atop the frame; breathing warm glow." } },
  },
};

export const Master: Story = {
  args: { level: 42 },
  parameters: {
    docs: { description: { story: "Violet identity. Flame edges replace corner nails + faint scanlines overlay; strong breathing glow." } },
  },
};

export const Sage: Story = {
  args: { level: 55 },
  parameters: {
    docs: { description: { story: "Endgame look — violet frame + amber accent line + rotating 4-rune ring + scanlines + gradient numeral." } },
  },
};

// ── The full progression — all 16 sample frames at once ──────────────────

export const FullProgression: Story = {
  parameters: {
    layout: "padded",
    docs: {
      description: {
        story:
          "All six tiers side-by-side at representative sub-levels. Use this to verify the visual progression reads at a glance and that within-tier drift is visible.",
      },
    },
  },
  render: () => {
    const SAMPLES = [
      { level: 1, label: "NOVICE · LV.01" },
      { level: 4, label: "NOVICE · LV.04" },
      { level: 5, label: "APPRENTICE · LV.05" },
      { level: 7, label: "APPRENTICE · LV.07" },
      { level: 9, label: "APPRENTICE · LV.09" },
      { level: 10, label: "ADEPT · LV.10" },
      { level: 15, label: "ADEPT · LV.15" },
      { level: 19, label: "ADEPT · LV.19" },
      { level: 20, label: "EXPERT · LV.20" },
      { level: 27, label: "EXPERT · LV.27" },
      { level: 34, label: "EXPERT · LV.34" },
      { level: 35, label: "MASTER · LV.35" },
      { level: 42, label: "MASTER · LV.42" },
      { level: 49, label: "MASTER · LV.49" },
      { level: 50, label: "SAGE · LV.50" },
      { level: 60, label: "SAGE · LV.60" },
    ];
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "20px",
          padding: "32px",
          background: "rgb(2, 6, 23)",
          minHeight: "100vh",
        }}
      >
        {SAMPLES.map((sample) => {
          const visuals = getLevelTierVisuals(sample.level);
          return (
            <div
              key={sample.level}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "10px",
                padding: "16px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(255,255,255,0.01)",
              }}
            >
              <TierLevelFrame level={sample.level} />
              <span
                style={{
                  fontFamily: "var(--font-pixel, monospace)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "rgb(148 163 184)",
                }}
              >
                {sample.label}
              </span>
              <span style={{ fontSize: 10, color: "rgb(100 116 139)" }}>
                sat +{(visuals.saturationOffset * 100).toFixed(0)}% · α{" "}
                {visuals.glowAlpha.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    );
  },
};

// ── Within-tier drift focus — Apprentice 5→9 only ────────────────────────

export const ApprenticeDrift: Story = {
  parameters: {
    layout: "padded",
    docs: {
      description: {
        story:
          "Just the 5 sub-levels of the Apprentice tier (5–9) so the within-tier saturation + glow drift is easy to compare side-by-side. LV.05 = base 0% saturation drift / 0.40 glow alpha; LV.09 = +25% / 0.65.",
      },
    },
  },
  render: () => (
    <div
      style={{
        display: "flex",
        gap: 28,
        padding: 40,
        background: "rgb(2, 6, 23)",
        alignItems: "center",
      }}
    >
      {[5, 6, 7, 8, 9].map((level) => {
        const visuals = getLevelTierVisuals(level);
        return (
          <div
            key={level}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <TierLevelFrame level={level} />
            <span
              style={{
                fontSize: 11,
                color: "rgb(148 163 184)",
                fontFamily: "var(--font-pixel, monospace)",
                letterSpacing: "0.08em",
              }}
            >
              LV.{String(level).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 10, color: "rgb(100 116 139)" }}>
              sat +{(visuals.saturationOffset * 100).toFixed(0)}% · α{" "}
              {visuals.glowAlpha.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  ),
};
