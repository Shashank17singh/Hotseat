import type { LlmReport, PlannedQuestion, Report, Turn } from "./types";

const HINT_PENALTY = 5;

export function verdictFor(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Solid";
  if (score >= 45) return "Developing";
  return "Needs work";
}

// Maps a score to a step of the theme's heat ramp. Step 1 is skipped: it is too dark to read on the ground.
export function heatStep(score: number) {
  if (score >= 85) return 6;
  if (score >= 70) return 5;
  if (score >= 55) return 4;
  if (score >= 40) return 3;
  return 2;
}

// The overall score is computed here, not taken from the model, so it always agrees with the per-question scores.
export function buildReport(llm: LlmReport, questions: PlannedQuestion[], turns: Turn[]): Report {
  const reviews = questions.map((question) => {
    const main = turns.find((t) => t.questionId === question.id && t.kind === "main");
    const review = llm.questions.find((q) => q.id === question.id);
    // Ending early leaves later questions unreached; those are excluded, while a deliberate skip scores zero.
    if (!main || (!main.answer && !main.code && !main.skipped)) {
      return { id: question.id, score: 0, whatWorked: "", whatToImprove: "", betterAnswer: "", assessed: false };
    }
    if (main.skipped) {
      return { id: question.id, score: 0, whatWorked: "", whatToImprove: "You skipped this question.", betterAnswer: review?.betterAnswer ?? "", assessed: true };
    }
    if (!review) {
      return { id: question.id, score: 0, whatWorked: "", whatToImprove: "", betterAnswer: "", assessed: false };
    }
    const hintUsed = turns.some((t) => t.questionId === question.id && t.hintUsed);
    const score = clampScore(review.score - (hintUsed ? HINT_PENALTY : 0));
    return { ...review, score, assessed: true };
  });

  const assessed = reviews.filter((r) => r.assessed);
  const overall = assessed.length
    ? Math.round(assessed.reduce((sum, r) => sum + r.score, 0) / assessed.length)
    : 0;

  return { ...llm, overall, verdict: verdictFor(overall), questions: reviews };
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
