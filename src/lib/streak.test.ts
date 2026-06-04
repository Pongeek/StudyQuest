import { describe, it, expect } from "vitest";
import { getStreakTitle, getEarnedStreakTitle } from "./streak";

describe("getStreakTitle", () => {
  it("returns null below the first threshold (under 7 days)", () => {
    expect(getStreakTitle(0)).toBeNull();
    expect(getStreakTitle(6)).toBeNull();
  });

  it("returns the exact title at each threshold day", () => {
    expect(getStreakTitle(7)).toBe("Disciplined");
    expect(getStreakTitle(14)).toBe("Relentless");
    expect(getStreakTitle(30)).toBe("Unbroken");
    expect(getStreakTitle(60)).toBe("Ascendant");
    expect(getStreakTitle(100)).toBe("Eternal");
  });

  it("returns the lower tier's title between thresholds", () => {
    expect(getStreakTitle(8)).toBe("Disciplined"); // just past 7
    expect(getStreakTitle(20)).toBe("Relentless"); // 14..29
    expect(getStreakTitle(99)).toBe("Ascendant"); // 60..99
    expect(getStreakTitle(250)).toBe("Eternal"); // open-ended top tier
  });
});

describe("getEarnedStreakTitle", () => {
  it("reports the title when an increment lands on a threshold", () => {
    expect(getEarnedStreakTitle(6, 7)).toEqual({ title: "Disciplined", days: 7 });
  });

  it("reports nothing for a mid-tier increment (no threshold crossed)", () => {
    expect(getEarnedStreakTitle(8, 9)).toBeNull();
  });

  it("reports nothing when the streak does not change (same-day study)", () => {
    expect(getEarnedStreakTitle(7, 7)).toBeNull();
  });

  it("reports nothing on a reset (streak drops back to 1)", () => {
    expect(getEarnedStreakTitle(30, 1)).toBeNull();
  });

  it("re-earns a title when rebuilt past a threshold after a reset", () => {
    // Detector is history-independent: a 6→7 climb earns Disciplined again,
    // regardless of any title held before the streak reset.
    expect(getEarnedStreakTitle(6, 7)).toEqual({ title: "Disciplined", days: 7 });
  });

  it("reports the highest title when a jump crosses multiple thresholds", () => {
    // (6, 20] crosses both 7 and 14 → the higher title wins.
    expect(getEarnedStreakTitle(6, 20)).toEqual({ title: "Relentless", days: 14 });
  });
});
