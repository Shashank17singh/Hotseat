import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COPY_LIMIT, copiedShare, lessonText } from "@/lib/learn";
import { writeLesson, writeOutline } from "@/lib/server/teach";
import { OutlineSchema } from "@/lib/types";
import type { Lesson } from "@/lib/types";

const docs = vi.hoisted(() => ({ result: null as { title: string; text: string } | null }));
vi.mock("@/lib/server/docs", () => ({ findDocs: async () => docs.result }));

const draft: Lesson = {
  summary: "A draft summary of the idea.",
  explanation: ["Plain def blocks the event loop."],
  example: "",
  code: "",
  pitfalls: [],
  interviewQuestions: [],
  checkPrompt: "Explain the idea in your words.",
  keyPoints: ["The main point"],
  sources: [],
};
const fixed: Lesson = { ...draft, explanation: ["Blocking calls inside async def block the event loop."] };
const outline = {
  title: "Course",
  skills: [{ id: "a", name: "Skill", claim: "", why: "", prerequisites: [], quiz: { question: "Which one?", options: ["A", "B"], correct: 0, explanation: "" } }],
};

const reply = (content: unknown) =>
  new Response(JSON.stringify({ id: "1", object: "chat.completion", created: 1, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const refused = () => new Response(JSON.stringify({ error: { message: "no" } }), { status: 400, headers: { "content-type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();
const request = { skill: { id: "s1", name: "Skill", claim: "", why: "", prerequisites: [] }, builtOn: [], seniority: "junior" as const };

beforeEach(() => {
  docs.result = null;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("LLM_PROVIDER", "");
  vi.stubEnv("GROQ_API_KEY", "k");
  vi.stubEnv("GEMINI_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("writeLesson", () => {
  it("shows the reviewer's corrected lesson, not the draft", async () => {
    fetchMock.mockResolvedValueOnce(reply(draft)).mockResolvedValueOnce(reply({ problems: ["Fixed the event loop claim"], lesson: fixed }));
    const lesson = await writeLesson(request);
    expect(lesson.explanation).toEqual(fixed.explanation);
    expect(lesson.reviewed).toBe(true);
  });

  it("sends the draft to the reviewer as fenced data", async () => {
    fetchMock.mockResolvedValueOnce(reply(draft)).mockResolvedValueOnce(reply({ problems: [], lesson: draft }));
    await writeLesson(request);
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.messages[1].content).toContain('<data name="draft">');
    expect(body.messages[1].content).toContain("Plain def blocks");
    expect(body.temperature).toBe(0.1);
  });

  it("gives the reviewer official docs and records which ones", async () => {
    docs.result = { title: "FastAPI", text: "Plain def runs in a thread pool." };
    fetchMock.mockResolvedValueOnce(reply(draft)).mockResolvedValueOnce(reply({ problems: [], lesson: fixed }));
    const lesson = await writeLesson(request);
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.messages[1].content).toContain('<data name="official_docs">');
    expect(body.messages[1].content).toContain("Plain def runs in a thread pool.");
    expect(lesson.checkedAgainst).toBe("FastAPI");
  });

  it("does not let the model claim a documentation check", async () => {
    fetchMock.mockResolvedValueOnce(reply(draft)).mockResolvedValueOnce(reply({ problems: [], lesson: { ...fixed, checkedAgainst: "Invented docs" } }));
    expect((await writeLesson(request)).checkedAgainst).toBeUndefined();
  });

  it("flags the lesson instead of pretending when the review fails", async () => {
    fetchMock.mockResolvedValueOnce(reply(draft)).mockResolvedValueOnce(refused());
    const lesson = await writeLesson(request);
    expect(lesson.summary).toBe(draft.summary);
    expect(lesson.reviewed).toBe(false);
  });

  it("does not let the model mark its own lesson as reviewed", async () => {
    fetchMock.mockResolvedValueOnce(reply({ ...draft, reviewed: true })).mockResolvedValueOnce(refused());
    expect((await writeLesson(request)).reviewed).toBe(false);
  });

  it("still fails when the first draft fails", async () => {
    fetchMock.mockResolvedValueOnce(refused());
    await expect(writeLesson(request)).rejects.toMatchObject({ code: "upstream" });
  });
});

describe("writeOutline", () => {
  const body = { seniority: "junior" as const, topics: "x" };

  it("uses the reviewed quizzes", async () => {
    const better = { ...outline, title: "Reviewed" };
    fetchMock.mockResolvedValueOnce(reply(outline)).mockResolvedValueOnce(reply(better));
    expect((await writeOutline(body)).title).toBe("Reviewed");
  });

  it("keeps the draft when the review fails", async () => {
    fetchMock.mockResolvedValueOnce(reply(outline)).mockResolvedValueOnce(refused());
    expect((await writeOutline(body)).title).toBe("Course");
  });
});

describe("OutlineSchema", () => {
  const good = outline.skills[0];
  const badQuiz = { ...good, id: "b", quiz: { ...good.quiz, correct: 9 } };

  it("drops one broken skill and keeps the course", () => {
    expect(OutlineSchema.parse({ title: "Course", skills: [good, badQuiz] }).skills.map((s) => s.id)).toEqual(["a"]);
  });

  it("still fails when no skill survives", () => {
    expect(OutlineSchema.safeParse({ title: "Course", skills: [badQuiz] }).success).toBe(false);
  });
});

describe("copiedShare", () => {
  const lesson: Lesson = { ...draft, explanation: ["An index is a sorted copy of a column that lets the database find rows without reading the whole table."] };

  it("catches pasted lesson text and key points", () => {
    expect(copiedShare(lesson.explanation[0], lessonText(lesson))).toBe(1);
    expect(copiedShare(draft.keyPoints.join(". "), lessonText(draft))).toBeLessThanOrEqual(1);
  });

  it("ignores case and punctuation", () => {
    expect(copiedShare("AN INDEX IS, a sorted copy; of a column!", lessonText(lesson))).toBe(1);
  });

  it("lets a real explanation through, even when it repeats a phrase", () => {
    const own = "Think of the back of a textbook: instead of flipping every page, the database jumps to the right rows, because an index is a sorted copy kept alongside the table.";
    expect(copiedShare(own, lessonText(lesson))).toBeLessThan(COPY_LIMIT);
  });

  it("does not judge answers too short to compare", () => {
    expect(copiedShare("It is sorted", lessonText(lesson))).toBe(0);
  });
});
