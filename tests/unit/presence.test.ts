import { describe, expect, it } from "vitest";
import { PresenceTally, isFacing } from "@/lib/presence";

function face(noseX: number) {
  const points = Array.from({ length: 300 }, () => ({ x: 0, y: 0 }));
  points[1] = { x: noseX, y: 0.5 };
  points[33] = { x: 0.6, y: 0.4 };
  points[263] = { x: 0.4, y: 0.4 };
  return points;
}

describe("isFacing", () => {
  it("accepts a centred nose", () => {
    expect(isFacing(face(0.5))).toBe(true);
  });

  it("rejects a head turned to either side", () => {
    expect(isFacing(face(0.41))).toBe(false);
    expect(isFacing(face(0.59))).toBe(false);
  });

  it("rejects incomplete landmarks", () => {
    expect(isFacing([])).toBe(false);
  });
});

describe("PresenceTally", () => {
  it("counts a frame with no face as not facing", () => {
    const tally = new PresenceTally();
    tally.add(face(0.5));
    tally.add(undefined);
    expect(tally.ratio()).toBe(0.5);
  });

  it("has no ratio without samples, so the report can omit it", () => {
    expect(new PresenceTally().ratio()).toBeUndefined();
  });
});
