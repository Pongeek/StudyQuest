import { describe, it, expect } from "vitest";
import { toDueTopicTitles } from "./review-queue";

describe("toDueTopicTitles", () => {
  it("projects joined rows to { topicTitle }", () => {
    const rows = [
      { topic_id: "a", topics: { title: "Regular Languages" } },
      { topic_id: "b", topics: { title: "Turing Machines" } },
    ];
    expect(toDueTopicTitles(rows)).toEqual([
      { topicTitle: "Regular Languages" },
      { topicTitle: "Turing Machines" },
    ]);
  });

  it("falls back to 'Unknown topic' when the join is missing or untitled", () => {
    const rows = [
      { topic_id: "a", topics: null },
      { topic_id: "b" },
      { topic_id: "c", topics: { title: null } },
    ];
    expect(toDueTopicTitles(rows)).toEqual([
      { topicTitle: "Unknown topic" },
      { topicTitle: "Unknown topic" },
      { topicTitle: "Unknown topic" },
    ]);
  });

  it("returns [] for null/undefined/non-array input", () => {
    expect(toDueTopicTitles(null)).toEqual([]);
    expect(toDueTopicTitles(undefined)).toEqual([]);
    expect(toDueTopicTitles({} as unknown)).toEqual([]);
  });
});
