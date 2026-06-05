import { describe, it, expect } from "vitest";
import { sumCappedStudyMinutes, type StudySessionTimes } from "./study-time";

/** Build a session that ran `minutes` long starting at a fixed instant. */
function session(startISO: string, minutes: number): StudySessionTimes {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + minutes * 60_000);
  return { started_at: start.toISOString(), completed_at: end.toISOString() };
}

describe("sumCappedStudyMinutes", () => {
  it("sums the duration of completed sessions", () => {
    const sessions = [
      session("2026-01-01T10:00:00.000Z", 10),
      session("2026-01-02T09:00:00.000Z", 10),
    ];
    expect(sumCappedStudyMinutes(sessions, 20)).toBe(20);
  });

  it("caps an over-long session at capMinutes", () => {
    const sessions = [session("2026-01-01T10:00:00.000Z", 90)];
    expect(sumCappedStudyMinutes(sessions, 20)).toBe(20);
  });

  it("skips sessions missing either timestamp", () => {
    const sessions: StudySessionTimes[] = [
      { started_at: "2026-01-01T10:00:00.000Z", completed_at: null },
      { started_at: null, completed_at: "2026-01-01T10:10:00.000Z" },
      session("2026-01-02T10:00:00.000Z", 5),
    ];
    expect(sumCappedStudyMinutes(sessions, 20)).toBe(5);
  });

  it("counts non-positive durations as zero", () => {
    const sessions: StudySessionTimes[] = [
      // completed before started — data anomaly
      { started_at: "2026-01-01T10:10:00.000Z", completed_at: "2026-01-01T10:00:00.000Z" },
    ];
    expect(sumCappedStudyMinutes(sessions, 20)).toBe(0);
  });

  it("returns 0 for no sessions", () => {
    expect(sumCappedStudyMinutes([], 20)).toBe(0);
  });

  it("floors fractional minutes", () => {
    const sessions = [session("2026-01-01T10:00:00.000Z", 1.5)]; // 90 seconds
    expect(sumCappedStudyMinutes(sessions, 20)).toBe(1);
  });
});
