import { describe, expect, test } from "bun:test";
import {
  barRangeToBeats,
  barsToBeats,
  beatsToBars,
  formatBarBeat,
} from "@dawai/core/time";

describe("bars/beats conversion", () => {
  test("4/4", () => {
    expect(barsToBeats(8, [4, 4])).toBe(32);
    expect(beatsToBars(32, [4, 4])).toBe(8);
  });

  test("7/8 uses the numerator as beats per bar", () => {
    expect(barsToBeats(2, [7, 8])).toBe(14);
  });
});

describe("formatBarBeat", () => {
  test("1-based bar.beat", () => {
    expect(formatBarBeat(0, [4, 4])).toBe("1.1");
    expect(formatBarBeat(4, [4, 4])).toBe("2.1");
    expect(formatBarBeat(6.5, [4, 4])).toBe("2.3.5");
  });
});

describe("barRangeToBeats", () => {
  test("inclusive 1-based range", () => {
    expect(barRangeToBeats("17..25", [4, 4])).toEqual({
      startBeat: 64,
      endBeat: 100,
    });
    expect(barRangeToBeats("1..1", [4, 4])).toEqual({
      startBeat: 0,
      endBeat: 4,
    });
  });

  test("rejects malformed and inverted ranges", () => {
    expect(() => barRangeToBeats("17-25", [4, 4])).toThrow(
      'Expected "<from>..<to>"',
    );
    expect(() => barRangeToBeats("9..3", [4, 4])).toThrow("from ≤ to");
    expect(() => barRangeToBeats("0..3", [4, 4])).toThrow("1-based");
  });
});
