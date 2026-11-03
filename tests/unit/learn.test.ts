import { describe, expect, it } from "vitest";
import {
  applyCheck, applyInterview, applyQuiz, claimAudit, courseStats, focusSkills, nextSkill, normalizeOutline, progressOf, skillState, verifiedClaim,
} from "@/lib/learn";
import type { Course, CourseOutline, ResumeProfile, Skill } from "@/lib/types";
import { session } from "./fixtures";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;

const profile: ResumeProfile = {
  name: "Ada",
  headline: "Backend engineer",
  summary: "",
  skills: ["PostgreSQL", "Go"],
  experience: [{ title: "Engineer", org: "Example", period: "2024", highlights: ["Reduced p95 latency by 40% with Redis caching"] }],
  projects: [],
  education: [],
};

const skill = (id: string, patch: Partial<Skill> = {}): Skill => ({
  id,
  name: `Skill ${id}`,
  claim: "",
  why: "",
  prerequisites: [],
  quiz: { question: "Which one is right?", options: ["Right", "Wrong"], correct: 0, explanation: "" },
  ...patch,
});

const outline = (skills: Skill[]): CourseOutline => ({ title: "Course", skills });

const course = (skills: Skill[], patch: Partial<Course> = {}): Course => ({
  id: "c1",
  title: "Course",
  createdAt: 0,
  updatedAt: 0,
  request: { seniority: "junior", topics: "x" },
  skills,
  progress: {},
  lessons: {},
  ...patch,
});

describe("verifiedClaim", () => {
  it("keeps words the resume really contains, ignoring case and punctuation", () => {
    expect(verifiedClaim("redis caching", profile)).toBe("redis caching");
    expect(verifiedClaim("Reduced p95 latency by 40%", profile)).toBe("Reduced p95 latency by 40%");
  });

  it("drops a claim the resume never made", () => {
    expect(verifiedClaim("Kafka consumer groups", profile)).toBe("");
  });

  it("matches whole words, so a short claim cannot hit inside another word", () => {
    expect(verifiedClaim("Exam", profile)).toBe("");
  });

  it("drops every claim when there is no resume", () => {
    expect(verifiedClaim("PostgreSQL")).toBe("");
  });
});

describe("normalizeOutline", () => {
  it("puts foundations before what builds on them, and renumbers ids", () => {
    const result = normalizeOutline(outline([skill("b", { prerequisites: ["a"] }), skill("a")]));
    expect(result.skills.map((s) => s.name)).toEqual(["Skill a", "Skill b"]);
    expect(result.skills.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(result.skills[1].prerequisites).toEqual(["s1"]);
  });

  it("survives a prerequisite cycle and leaves no skill waiting on a later one", () => {
    const { skills } = normalizeOutline(outline([skill("a", { prerequisites: ["b"] }), skill("b", { prerequisites: ["a"] })]));
    expect(skills).toHaveLength(2);
    expect(skills[0].prerequisites).toEqual([]);
    expect(skills[1].prerequisites).toEqual(["s1"]);
  });

  it("drops unknown and self prerequisites, and duplicate skills", () => {
    const { skills } = normalizeOutline(outline([skill("a", { prerequisites: ["a", "ghost"] }), skill("a")]));
    expect(skills).toHaveLength(1);
    expect(skills[0].prerequisites).toEqual([]);
  });

  it("makes ids safe for a URL whatever the model sent", () => {
    expect(normalizeOutline(outline([skill("../../x")])).skills[0].id).toBe("s1");
  });

  it("caps the course at eight skills", () => {
    const many = Array.from({ length: 12 }, (_, i) => skill(`x${i}`));
    expect(normalizeOutline(outline(many)).skills).toHaveLength(8);
  });

  it("removes unverifiable claims", () => {
    const { skills } = normalizeOutline(outline([skill("a", { claim: "Kafka" }), skill("b", { claim: "PostgreSQL" })]), profile);
    expect(skills.map((s) => s.claim)).toEqual(["", "PostgreSQL"]);
  });

  it("drops a catch-all option unless it is the answer", () => {
    const quiz = { question: "Which one?", options: ["A", "B", "All of the above", "C"], correct: 3, explanation: "" };
    const [kept] = normalizeOutline(outline([skill("a", { quiz })]), undefined, () => 0.5).skills;
    expect(kept.quiz.options).not.toContain("All of the above");
    expect(kept.quiz.options[kept.quiz.correct]).toBe("C");
    const answer = { ...quiz, correct: 2 };
    const [left] = normalizeOutline(outline([skill("a", { quiz: answer })]), undefined, () => 0.5).skills;
    expect(left.quiz.options[left.quiz.correct]).toBe("All of the above");
  });

  it("shuffles quiz options and keeps the answer pointing at the same text", () => {
    const quiz = { question: "Which one?", options: ["A", "B", "C", "D"], correct: 2, explanation: "" };
    for (const roll of [0, 0.3, 0.6, 0.99]) {
      const [result] = normalizeOutline(outline([skill("a", { quiz })]), undefined, () => roll).skills;
      expect(result.quiz.options[result.quiz.correct]).toBe("C");
      expect([...result.quiz.options].sort()).toEqual(["A", "B", "C", "D"]);
    }
  });
});

describe("quiz placement", () => {
  const base = course([skill("s1"), skill("s2"), skill("s3")]);

  it("records right, wrong and unsure, and marks only the last two weak", () => {
    const placed = applyQuiz(base, { s1: 0, s2: 1, s3: "unsure" }, NOW);
    expect(placed.quizzedAt).toBe(NOW);
    expect(progressOf(placed, "s1")).toMatchObject({ quiz: "correct", weak: false });
    expect(progressOf(placed, "s2")).toMatchObject({ quiz: "wrong", weak: true });
    expect(progressOf(placed, "s3")).toMatchObject({ quiz: "unsure", weak: true });
  });

  it("recommends the first skill the quiz did not place out of", () => {
    const placed = applyQuiz(base, { s1: 0, s2: 1, s3: "unsure" }, NOW);
    expect(nextSkill(placed, NOW)?.id).toBe("s2");
  });

  it("does not count a quiz pass as ready", () => {
    const placed = applyQuiz(base, { s1: 0 }, NOW);
    expect(courseStats(placed, NOW).ready).toBe(0);
  });
});

describe("explain-back checks", () => {
  const base = course([skill("s1"), skill("s2")]);

  it("passes at 70 and not at 69", () => {
    expect(progressOf(applyCheck(base, "s1", 70, NOW), "s1").level).toBe(1);
    expect(progressOf(applyCheck(base, "s1", 69, NOW), "s1")).toMatchObject({ level: 0, weak: true });
  });

  it("spaces reviews further apart with each pass", () => {
    const gaps = [1, 3, 7, 14, 30, 30];
    let current = base;
    let now = NOW;
    for (const days of gaps) {
      current = applyCheck(current, "s1", 90, now);
      expect(progressOf(current, "s1").dueAt).toBe(now + days * DAY);
      now += days * DAY;
    }
    expect(progressOf(current, "s1").level).toBe(5);
  });

  it("brings a passed skill back when its review falls due, ahead of new work", () => {
    const passed = applyCheck(base, "s2", 90, NOW);
    expect(skillState(progressOf(passed, "s2"), NOW)).toBe("ready");
    expect(nextSkill(passed, NOW)?.id).toBe("s1");
    expect(skillState(progressOf(passed, "s2"), NOW + DAY)).toBe("review");
    expect(nextSkill(passed, NOW + DAY)?.id).toBe("s2");
  });

  it("drops a level and stays due after a failed review", () => {
    const twice = applyCheck(applyCheck(base, "s1", 90, NOW), "s1", 90, NOW);
    const failed = applyCheck(twice, "s1", 20, NOW);
    expect(progressOf(failed, "s1")).toMatchObject({ level: 1, weak: true, dueAt: NOW, attempts: 3 });
    expect(skillState(progressOf(failed, "s1"), NOW)).toBe("review");
  });

  it("clears weakness on a pass", () => {
    const fixed = applyCheck(applyCheck(base, "s1", 10, NOW), "s1", 80, NOW);
    expect(progressOf(fixed, "s1").weak).toBe(false);
  });

  it("offers nothing once every skill is ready", () => {
    const done = applyCheck(applyCheck(base, "s1", 90, NOW), "s2", 90, NOW);
    expect(nextSkill(done, NOW)).toBeUndefined();
    expect(courseStats(done, NOW)).toEqual({ total: 2, ready: 2, due: 0 });
  });
});

describe("claimAudit", () => {
  const base = course([skill("s1", { claim: "Redis" }), skill("s2", { claim: "Go" }), skill("s3", { claim: "PostgreSQL" }), skill("s4")]);

  it("covers only skills tied to a resume line", () => {
    expect(claimAudit(base).map((entry) => entry.skill.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("needs an explanation to defend a claim, not a quiz pass", () => {
    let current = applyQuiz(base, { s1: 1, s2: 0, s3: 0 }, NOW);
    current = applyCheck(current, "s3", 90, NOW);
    expect(claimAudit(current).map((entry) => entry.verdict)).toEqual(["shaky", "unchecked", "defended"]);
  });
});

describe("the interview loop", () => {
  const skills = [skill("s1"), skill("s2"), skill("s3")];
  const planned = (ids: (string | undefined)[]) =>
    ids.map((skillId, i) => ({ id: `q${i + 1}`, question: "A question?", competency: "x", hint: "", signals: [], answerFormat: "spoken" as const, skillId }));
  const interview = (scores: { score: number; assessed: boolean }[], ids: (string | undefined)[]) =>
    session({
      id: "i1",
      plan: { greeting: "Hello there.", questions: planned(ids) },
      report: {
        summary: "", strengths: [], improvements: [], competencies: [], nextSteps: [], overall: 50, verdict: "x",
        questions: scores.map((s, i) => ({ id: `q${i + 1}`, whatWorked: "", whatToImprove: "", betterAnswer: "", ...s })),
      },
    });

  it("sends a weak answer's skill back, even after a pass", () => {
    const passed = applyCheck(course(skills), "s1", 90, NOW);
    const { course: updated, reopened } = applyInterview(passed, interview([{ score: 40, assessed: true }], ["s1"]), NOW);
    expect(reopened).toEqual(["Skill s1"]);
    expect(progressOf(updated, "s1")).toMatchObject({ level: 0, weak: true, dueAt: NOW });
    expect(nextSkill(updated, NOW)?.id).toBe("s1");
  });

  it("leaves strong answers, unreached questions and unknown skills alone", () => {
    const start = course(skills);
    const { course: updated, reopened } = applyInterview(
      start,
      interview([{ score: 65, assessed: true }, { score: 0, assessed: false }, { score: 10, assessed: true }], ["s1", "s2", "invented"]),
      NOW,
    );
    expect(reopened).toEqual([]);
    expect(updated).toBe(start);
  });

  it("does not lower a skill twice for the same interview", () => {
    const start = applyCheck(applyCheck(course(skills), "s1", 90, NOW), "s1", 90, NOW);
    const report = interview([{ score: 40, assessed: true }, { score: 30, assessed: true }], ["s1", "s1"]);
    const once = applyInterview(start, report, NOW);
    const again = applyInterview(once.course, report, NOW);
    expect(progressOf(again.course, "s1").level).toBe(1);
    expect(again.reopened).toEqual(["Skill s1"]);
  });
});

describe("focusSkills", () => {
  it("presses on the shakiest skills first and leaves unstudied ones last", () => {
    let current = course([skill("s1"), skill("s2"), skill("s3")]);
    current = applyCheck(current, "s2", 90, NOW);
    current = applyCheck(current, "s3", 10, NOW);
    expect(focusSkills(current, NOW).map((s) => s.id)).toEqual(["s3", "s2", "s1"]);
  });
});
