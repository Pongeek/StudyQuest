import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import QuestBoard from "./QuestBoard";

const meta: Meta<typeof QuestBoard> = {
  title: "Gamification/QuestBoard",
  component: QuestBoard,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof QuestBoard>;

export const ThreeQuests: Story = {
  args: {
    recommendations: [
      {
        topicId: "t1",
        topicTitle: "1.1 Finite Automata",
        courseId: "c1",
        courseName: "Computational Models",
        masteryLevel: 0,
      },
      {
        topicId: "t2",
        topicTitle: "1.3 Regular Expressions",
        courseId: "c1",
        courseName: "Computational Models",
        masteryLevel: 1,
      },
      {
        topicId: "t3",
        topicTitle: "2.1 Context-Free Grammars",
        courseId: "c1",
        courseName: "Computational Models",
        masteryLevel: 0,
      },
    ],
  },
};

export const SingleFeatured: Story = {
  args: {
    recommendations: [
      {
        topicId: "t1",
        topicTitle: "1.1 Finite Automata",
        courseId: "c1",
        courseName: "Computational Models",
        masteryLevel: 0,
      },
    ],
  },
};

export const MixedMastery: Story = {
  args: {
    recommendations: [
      {
        topicId: "t1",
        topicTitle: "3.2 Turing Machines",
        courseId: "c1",
        courseName: "Computational Models",
        masteryLevel: 0,
      },
      {
        topicId: "t2",
        topicTitle: "1.4 Pumping Lemma",
        courseId: "c1",
        courseName: "Computational Models",
        masteryLevel: 3,
      },
      {
        topicId: "t3",
        topicTitle: "2.3 Pushdown Automata",
        courseId: "c1",
        courseName: "Computational Models",
        masteryLevel: 1,
      },
    ],
  },
};
