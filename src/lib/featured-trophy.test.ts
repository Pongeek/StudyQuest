import { describe, it, expect } from "vitest";
import { resolveFeaturedTrophy } from "./featured-trophy";

const earned = [
  { id: "c", name: "Newest" }, // most-recently earned first
  { id: "b", name: "Middle" },
  { id: "a", name: "Oldest" },
];

describe("resolveFeaturedTrophy", () => {
  it("returns the explicitly pinned trophy when still earned", () => {
    expect(resolveFeaturedTrophy("b", earned)).toEqual({ id: "b", name: "Middle" });
  });

  it("falls back to the most-recently earned when nothing is pinned", () => {
    expect(resolveFeaturedTrophy(null, earned)).toEqual({ id: "c", name: "Newest" });
  });

  it("falls back to most-recent when the pinned id is no longer earned (stale)", () => {
    expect(resolveFeaturedTrophy("gone", earned)).toEqual({ id: "c", name: "Newest" });
  });

  it("returns null when no trophies are earned", () => {
    expect(resolveFeaturedTrophy("b", [])).toBeNull();
    expect(resolveFeaturedTrophy(null, [])).toBeNull();
  });
});
