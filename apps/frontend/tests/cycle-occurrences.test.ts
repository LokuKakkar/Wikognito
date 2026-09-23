import { describe, expect, it } from "vitest";
import { advanceOccurrenceCursor, nextOccurrenceIndex } from "../lib/cycle-occurrences";

describe("cycle occurrences", () => {
  it("starts at 0 and wraps", () => {
    expect(nextOccurrenceIndex(undefined, 3)).toBe(0);
    expect(nextOccurrenceIndex(0, 3)).toBe(0);
    expect(nextOccurrenceIndex(2, 3)).toBe(2);
    expect(nextOccurrenceIndex(3, 3)).toBe(0);
    expect(nextOccurrenceIndex(0, 0)).toBe(0);
  });

  it("advances a per-guess cursor", () => {
    const cursor = new Map<string, number>();
    expect(advanceOccurrenceCursor(cursor, "ada", 2)).toBe(0);
    expect(advanceOccurrenceCursor(cursor, "ada", 2)).toBe(1);
    expect(advanceOccurrenceCursor(cursor, "ada", 2)).toBe(0);
    expect(advanceOccurrenceCursor(cursor, "english", 1)).toBe(0);
  });
});
