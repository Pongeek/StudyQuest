import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import LevelBadge from "./LevelBadge";

const meta: Meta<typeof LevelBadge> = {
  title: "Gamification/LevelBadge",
  component: LevelBadge,
  parameters: { layout: "centered" },
  argTypes: {
    level: {
      control: { type: "range", min: 1, max: 60, step: 1 },
      description: "Player level. Adept (10+) and above get foil shimmer.",
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
    },
    showTitle: {
      control: "boolean",
      description: "Show 'Level N · Class' beside the hex shield.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof LevelBadge>;

export const Novice: Story = {
  args: { level: 3 },
};

export const Apprentice: Story = {
  args: { level: 7 },
};

export const AdeptShimmer: Story = {
  args: { level: 12 },
};

export const ExpertShimmer: Story = {
  args: { level: 25 },
};

export const MasterShimmer: Story = {
  args: { level: 40, size: "lg" },
};

export const SageEndgame: Story = {
  args: { level: 55, size: "lg" },
};

export const NoTitleSmall: Story = {
  args: { level: 12, size: "sm", showTitle: false },
};
