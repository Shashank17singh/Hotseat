import type { AnswerMetrics } from "./types";

// "like" and "right" are left out: too many legitimate uses to count honestly.
const FILLERS = ["um", "umm", "uh", "uhh", "er", "erm", "hmm", "you know", "i mean", "sort of", "kind of", "basically", "literally"];

// Rates from a clip shorter than this are noise: three words in a second is not 180 words a minute.
const MIN_MEASURABLE_SEC = 5;

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countFillers(text: string) {
  const lower = text.toLowerCase();
  const found: Record<string, number> = {};
  let total = 0;
  for (const filler of FILLERS) {
    const hits = lower.match(new RegExp(`\\b${filler}\\b`, "g"))?.length ?? 0;
    if (hits > 0) {
      found[filler] = hits;
      total += hits;
    }
  }
  return { total, found };
}

export function summarizeLevels(levels: number[], intervalMs: number, threshold = 0.02) {
  if (levels.length === 0) return { longestPauseSec: 0, silenceRatio: 0 };
  let silent = 0;
  let run = 0;
  let longest = 0;
  for (const level of levels) {
    if (level < threshold) {
      silent += 1;
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return {
    longestPauseSec: round1((longest * intervalMs) / 1000),
    silenceRatio: Math.round((silent / levels.length) * 100) / 100,
  };
}

export function buildMetrics(input: {
  text: string;
  seconds: number;
  mode: AnswerMetrics["mode"];
  levels?: number[];
  levelIntervalMs?: number;
}): AnswerMetrics {
  const words = countWords(input.text);
  const { total, found } = countFillers(input.text);
  const pauses = summarizeLevels(input.levels ?? [], input.levelIntervalMs ?? 100);
  return {
    mode: input.mode,
    seconds: Math.round(input.seconds),
    words,
    wordsPerMinute: input.seconds >= MIN_MEASURABLE_SEC ? Math.round(words / (input.seconds / 60)) : 0,
    fillers: total,
    fillerWords: found,
    ...pauses,
  };
}

export type DeliverySummary = {
  answers: number;
  words: number;
  wordsPerMinute: number;
  fillersPerMinute: number;
  longestPauseSec: number;
  spokenSeconds: number;
};

export function summarizeDelivery(metrics: AnswerMetrics[]): DeliverySummary | null {
  const voice = metrics.filter((m) => m.mode === "voice" && m.seconds > 0);
  if (voice.length === 0) return null;
  const spokenSeconds = voice.reduce((sum, m) => sum + m.seconds, 0);
  const words = voice.reduce((sum, m) => sum + m.words, 0);
  const fillers = voice.reduce((sum, m) => sum + m.fillers, 0);
  const minutes = spokenSeconds / 60;
  const measurable = spokenSeconds >= MIN_MEASURABLE_SEC;
  return {
    answers: voice.length,
    words,
    spokenSeconds,
    wordsPerMinute: measurable ? Math.round(words / minutes) : 0,
    fillersPerMinute: measurable ? round1(fillers / minutes) : 0,
    longestPauseSec: Math.max(...voice.map((m) => m.longestPauseSec)),
  };
}

export function paceNote(wordsPerMinute: number) {
  if (wordsPerMinute === 0) return "Not enough speech to measure";
  if (wordsPerMinute < 110) return "Slow. Aim for 120 to 160";
  if (wordsPerMinute > 170) return "Fast. Aim for 120 to 160";
  return "Comfortable pace";
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
