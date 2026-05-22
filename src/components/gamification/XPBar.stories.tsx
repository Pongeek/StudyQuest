import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import XPBar from "./XPBar";

const meta: Meta<typeof XPBar> = {
  title: "Gamification/XPBar",
  component: XPBar,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    totalXp: {
      control: { type: "range", min: 0, max: 5000, step: 50 },
      description: "Total XP earned. Drives level + progress fill.",
    },
    compact: {
      control: "boolean",
      description: "Compact pill variant (level chip + thin bar).",
    },
  },
};

export default meta;
type Story = StoryObj<typeof XPBar>;

export const NewAdventurer: Story = {
  args: { totalXp: 40 },
};

export const MidLevel: Story = {
  args: { totalXp: 850 },
};

export const HighLevel: Story = {
  args: { totalXp: 3200 },
};

export const Compact: Story = {
  args: { totalXp: 850, compact: true },
};
