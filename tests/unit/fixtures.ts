import type { InterviewConfig, PlannedQuestion, Session, Turn } from "@/lib/types";

export const config: InterviewConfig = {
  role: "Backend Engineer",
  seniority: "junior",
  type: "mixed",
  difficulty: "medium",
  persona: "neutral",
  questionCount: 3,
};

export const question = (n: number): PlannedQuestion => ({
  id: `q${n}`,
  question: `Question number ${n}?`,
  competency: "Problem solving",
  hint: "Use an example.",
  signals: ["A result"],
  answerFormat: "spoken",
});

export const turn = (n: number, patch: Partial<Turn> = {}): Turn => ({
  id: `q${n}-${n}`,
  questionId: `q${n}`,
  kind: "main",
  prompt: `Question number ${n}?`,
  answer: "An answer.",
  skipped: false,
  hintUsed: false,
  ...patch,
});

export function session(patch: Partial<Session> = {}): Session {
  return {
    id: "s1",
    createdAt: 1,
    updatedAt: 1,
    config,
    plan: { greeting: "Hello there.", questions: [question(1), question(2), question(3)] },
    turns: [],
    status: "in_progress",
    ...patch,
  };
}
