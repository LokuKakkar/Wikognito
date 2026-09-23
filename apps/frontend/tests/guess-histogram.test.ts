import { describe, expect, it } from "vitest";
import {
  bucketStartForGuesses,
  buildGuessHistogram,
  chooseGuessBucketSize,
  niceCeiling,
  yAxisTicks,
} from "../lib/guess-histogram";

describe("guess histogram", () => {
  it("uses fives when a ten-guess grouping would have fewer than five buckets", () => {
    expect(chooseGuessBucketSize({ "3": 4, "12": 2, "40": 1 })).toBe(5);
    const { buckets, bucketSize } = buildGuessHistogram({ "3": 4, "12": 2, "40": 1 });
    expect(bucketSize).toBe(5);
    expect(buckets.map((bucket) => bucket.start)).toEqual([1, 6, 11, 16, 21, 26, 31, 36]);
    expect(buckets.map((bucket) => bucket.count)).toEqual([4, 0, 2, 0, 0, 0, 0, 1]);
    expect(buckets[0]?.label).toBe("1");
    expect(buckets[2]?.label).toBe("11");
  });

  it("keeps tens once there are at least five coarse buckets", () => {
    const { buckets, bucketSize } = buildGuessHistogram({ "3": 1, "55": 2 });
    expect(bucketSize).toBe(10);
    expect(buckets.map((bucket) => bucket.start)).toEqual([1, 11, 21, 31, 41, 51]);
    expect(buckets.map((bucket) => bucket.count)).toEqual([1, 0, 0, 0, 0, 2]);
  });

  it("collapses 201+ into one overflow bar", () => {
    const { buckets } = buildGuessHistogram({ "5": 1, "250": 3 });
    expect(buckets.at(-1)).toMatchObject({ start: 201, label: "201+", count: 3 });
    expect(buckets).toHaveLength(21);
  });

  it("scales the y-axis to a nice ceiling of the max bar", () => {
    expect(niceCeiling(1)).toBe(1);
    expect(niceCeiling(8)).toBe(10);
    expect(niceCeiling(12)).toBe(20);
    expect(niceCeiling(47)).toBe(50);
    expect(yAxisTicks(8)).toEqual([0, 5, 10]);
    expect(yAxisTicks(1)).toEqual([0, 1]);
  });

  it("maps a player guess into the matching bucket start", () => {
    expect(bucketStartForGuesses(1, 10)).toBe(1);
    expect(bucketStartForGuesses(10, 10)).toBe(1);
    expect(bucketStartForGuesses(11, 10)).toBe(11);
    expect(bucketStartForGuesses(10, 5)).toBe(6);
    expect(bucketStartForGuesses(201, 10)).toBe(201);
  });
});
