import { describe, it, expect } from "vitest";
import { OVERLAY_COPY, INLINE_COPY } from "./loading-copy";

// Contract tests for the loading-copy module. These assert the COPY CONTRACT,
// not exact wording — exact strings get tweaked freely, the contract is what
// every loading surface depends on.

describe("OVERLAY_COPY", () => {
  it("resolves every overlay kind to a title + at least one non-empty message", () => {
    for (const [kind, copy] of Object.entries(OVERLAY_COPY)) {
      expect(copy.title.trim(), `${kind} title`).not.toBe("");
      expect(copy.messages.length, `${kind} messages`).toBeGreaterThan(0);
      for (const message of copy.messages) {
        expect(message.trim(), `${kind} message`).not.toBe("");
      }
    }
  });
});

describe("INLINE_COPY", () => {
  it("resolves every inline surface key to a non-empty single line", () => {
    for (const [surface, line] of Object.entries(INLINE_COPY)) {
      expect(line.trim(), `${surface} line`).not.toBe("");
    }
  });
});

describe("loading-copy voice rule", () => {
  // Encodes the exact "AI is grading" regression being fixed: no loading
  // string — overlay or inline — may self-reference as an AI.
  const allStrings = [
    ...Object.values(OVERLAY_COPY).flatMap((c) => [c.title, ...c.messages]),
    ...Object.values(INLINE_COPY),
  ];

  it("contains no string that self-references as an AI", () => {
    for (const str of allStrings) {
      expect(str, `loading string "${str}"`).not.toMatch(/\bAI\b/);
    }
  });
});
