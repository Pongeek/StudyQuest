import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import QuestCard from "./QuestCard";

const meta: Meta<typeof QuestCard> = {
  title: "Gamification/QuestCard",
  component: QuestCard,
  parameters: { layout: "centered" },
  argTypes: {
    tier: {
      control: "radio",
      options: ["featured", "priority", "standard"],
    },
    masteryLevel: {
      control: { type: "range", min: 0, max: 5, step: 1 },
      description:
        "Drives difficulty chip: 0 → LVL I UNCHARTED, 1 → LVL II CHALLENGING, 2+ → LVL III VETERAN.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof QuestCard>;

const baseArgs = {
  topicId: "topic-demo-1",
  href: "#",
};

export const Featured: Story = {
  args: {
    ...baseArgs,
    tier: "featured",
    topicTitle: "1.1 Finite Automata",
    courseName: "Computational Models",
    masteryLevel: 0,
  },
};

export const Priority: Story = {
  args: {
    ...baseArgs,
    tier: "priority",
    topicTitle: "1.3 Regular Expressions",
    courseName: "Computational Models",
    masteryLevel: 1,
  },
};

export const Standard: Story = {
  args: {
    ...baseArgs,
    tier: "standard",
    topicTitle: "2.1 Context-Free Grammars",
    courseName: "Computational Models",
    masteryLevel: 0,
  },
};

export const VeteranTopic: Story = {
  args: {
    ...baseArgs,
    tier: "priority",
    topicTitle: "1.4 Pumping Lemma",
    courseName: "Computational Models",
    masteryLevel: 3,
  },
};

export const HebrewRTL: Story = {
  args: {
    ...baseArgs,
    tier: "featured",
    topicTitle: "1.1 אוטומטים סופיים",
    courseName: "מודלים חישוביים",
    masteryLevel: 0,
  },
};
