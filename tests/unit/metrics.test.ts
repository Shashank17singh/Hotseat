import { describe, expect, it } from "vitest";
import { buildMetrics, countFillers, paceNote, summarizeDelivery, summarizeLevels } from "@/lib/metrics";

describe("countFillers", () => {
  it("counts whole words and phrases only", () => {
    const { total, found } = countFillers("Um, I mean, the umbrella album was, uh, basically done. Um.");
    expect(found).toEqual({ um: 2, uh: 1, "i mean": 1, basically: 1 });
    expect(total).toBe(5);
  });

  it("does not count like, which has too many honest uses", () => {
    expect(countFillers("I would like a system like this").total).toBe(0);
  });
});

describe("summarizeLevels", () => {
  it("finds the longest silent run", () => {
    const levels = [0.5, 0.001, 0.001, 0.001, 0.5, 0.001, 0.5, 0.5];
    expect(summarizeLevels(levels, 100)).toEqual({ longestPauseSec: 0.3, silenceRatio: 0.5 });
  });

  it("handles no samples", () => {
    expect(summarizeLevels([], 100)).toEqual({ longestPauseSec: 0, silenceRatio: 0 });
  });
});

describe("buildMetrics", () => {
  it("computes pace from words and time", () => {
    const text = Array(150).fill("word").join(" ");
    expect(buildMetrics({ text, seconds: 60, mode: "voice" }).wordsPerMinute).toBe(150);
  });

  it("reports no pace for a clip too short to measure", () => {
    expect(buildMetrics({ text: "yes", seconds: 2, mode: "voice" }).wordsPerMinute).toBe(0);
  });
});

describe("summarizeDelivery", () => {
  it("weights by time across voice answers and ignores typed ones", () => {
    const voice = (seconds: number, words: number, fillers: number) => ({
      mode: "voice" as const, seconds, words, wordsPerMinute: 0, fillers, fillerWords: {}, longestPauseSec: seconds / 60, silenceRatio: 0,
    });
    const typed = { ...voice(600, 10, 50), mode: "typed" as const };
    expect(summarizeDelivery([voice(60, 120, 2), voice(120, 300, 4), typed])).toEqual({
      answers: 2, words: 420, spokenSeconds: 180, wordsPerMinute: 140, fillersPerMinute: 2, longestPauseSec: 2,
    });
  });

  it("reports no rates from too little speech", () => {
    const short = { mode: "voice" as const, seconds: 3, words: 18, wordsPerMinute: 0, fillers: 2, fillerWords: {}, longestPauseSec: 0, silenceRatio: 0 };
    expect(summarizeDelivery([short])).toMatchObject({ wordsPerMinute: 0, fillersPerMinute: 0 });
  });

  it("returns null when nothing was spoken", () => {
    expect(summarizeDelivery([])).toBeNull();
  });
});

describe("paceNote", () => {
  it("flags slow and fast speech", () => {
    expect(paceNote(90)).toMatch(/^Slow/);
    expect(paceNote(140)).toBe("Comfortable pace");
    expect(paceNote(200)).toMatch(/^Fast/);
  });
});
