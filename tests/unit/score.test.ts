import { describe, expect, it } from "vitest";
import { buildReport, heatStep, verdictFor } from "@/lib/score";
import type { LlmReport } from "@/lib/types";
import { question, turn } from "./fixtures";

const llm = (scores: Record<string, number>): LlmReport => ({
  summary: "",
  strengths: [],
  improvements: [],
  competencies: [],
  nextSteps: [],
  questions: Object.entries(scores).map(([id, score]) => ({ id, score, whatWorked: "", whatToImprove: "", betterAnswer: "" })),
});

const questions = [question(1), question(2), question(3)];

describe("buildReport", () => {
  it("averages question scores itself and ignores any model-side total", () => {
    const report = buildReport(llm({ q1: 80, q2: 60, q3: 70 }), questions, [turn(1), turn(2), turn(3)]);
    expect(report.overall).toBe(70);
    expect(report.verdict).toBe("Solid");
  });

  it("excludes questions the candidate never reached", () => {
    const report = buildReport(llm({ q1: 90, q2: 90, q3: 90 }), questions, [turn(1)]);
    expect(report.overall).toBe(90);
    expect(report.questions.map((q) => q.assessed)).toEqual([true, false, false]);
  });

  it("scores a deliberate skip as zero even if the model scored it", () => {
    const report = buildReport(llm({ q1: 80, q2: 90 }), questions.slice(0, 2), [turn(1), turn(2, { answer: "", skipped: true })]);
    expect(report.questions[1].score).toBe(0);
    expect(report.overall).toBe(40);
  });

  it("takes 5 points for a hint and never goes below zero", () => {
    const report = buildReport(llm({ q1: 80, q2: 2 }), questions.slice(0, 2), [turn(1, { hintUsed: true }), turn(2, { hintUsed: true })]);
    expect(report.questions.map((q) => q.score)).toEqual([75, 0]);
  });

  it("marks an answered question the model omitted as not assessed instead of zero", () => {
    const report = buildReport(llm({ q1: 80 }), questions.slice(0, 2), [turn(1), turn(2)]);
    expect(report.questions[1].assessed).toBe(false);
    expect(report.overall).toBe(80);
  });

  it("scores a code-only answer", () => {
    const report = buildReport(llm({ q1: 80 }), questions.slice(0, 1), [turn(1, { answer: "", code: "fn()" })]);
    expect(report.questions[0].assessed).toBe(true);
  });

  it("returns zero, not NaN, when nothing can be assessed", () => {
    expect(buildReport(llm({}), questions, []).overall).toBe(0);
  });
});

describe("bands", () => {
  it.each([[85, 6], [84, 5], [70, 5], [69, 4], [55, 4], [54, 3], [40, 3], [39, 2], [0, 2]])("heatStep(%i) is %i", (score, step) => {
    expect(heatStep(score)).toBe(step);
  });

  it.each([[80, "Strong"], [79, "Solid"], [65, "Solid"], [64, "Developing"], [45, "Developing"], [44, "Needs work"]])("verdictFor(%i)", (score, verdict) => {
    expect(verdictFor(score)).toBe(verdict);
  });
});
