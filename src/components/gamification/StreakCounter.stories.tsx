import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import StreakCounter from "./StreakCounter";

const meta: Meta<typeof StreakCounter> = {
  title: "Gamification/StreakCounter",
  component: StreakCounter,
  parameters: { layout: "centered" },
  argTypes: {
    streak: {
      control: { type: "range", min: 0, max: 60, step: 1 },
      description:
        "Day streak. Fire ignites at 7+ (orange). Blazing tier at 30+ (light orange + 2 freezes).",
    },
    compact: {
      control: "boolean",
      description: "Compact pill (sidebar / dashboard nav).",
    },
  },
};

export default meta;
type Story = StoryObj<typeof StreakCounter>;

export const Cold: Story = {
  args: { streak: 0 },
};

export const Warming: Story = {
  args: { streak: 3 },
};

export const Hot: Story = {
  args: { streak: 7 },
};

export const Blazing: Story = {
  args: { streak: 30 },
};

export const CompactCold: Story = {
  args: { streak: 2, compact: true },
};

export const CompactHot: Story = {
  args: { streak: 14, compact: true },
};
