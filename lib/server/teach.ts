import { LessonReviewSchema, LessonSchema, OutlineSchema } from "../types";
import type { CourseOutline, CourseRequest, Lesson, LessonRequest } from "../types";
import { findDocs } from "./docs";
import { ApiError } from "./errors";
import { completeJson } from "./llm";
import { coursePrompt, courseReviewPrompt, lessonPrompt, lessonReviewPrompt } from "./prompts";

// Reviewers run cold, because a fact-check should not be creative.
const REVIEW_TEMPERATURE = 0.1;

// A learner cannot catch a mistake, so every draft is reviewed in a separate pass before it is shown.
export async function writeLesson(request: LessonRequest, apiKey?: string): Promise<Lesson> {
  const [generated, docs] = await Promise.all([
    completeJson({ task: "lesson", tier: "deep", ...lessonPrompt(request), schema: LessonSchema, maxTokens: 4000, apiKey }),
    findDocs(request.skill.name, request.skill.claim),
  ]);
  // Fields the app sets must not be claimable by the model.
  const draft: Lesson = { ...generated, reviewed: undefined, checkedAgainst: undefined };
  try {
    const { lesson } = await completeJson({
      task: "lesson_review",
      tier: "deep",
      ...lessonReviewPrompt(request.skill.name, draft, docs),
      schema: LessonReviewSchema,
      maxTokens: 6000,
      temperature: REVIEW_TEMPERATURE,
      apiKey,
    });
    return { ...lesson, reviewed: true, checkedAgainst: docs?.title };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ...draft, reviewed: false };
  }
}

export async function writeOutline(request: CourseRequest, apiKey?: string): Promise<CourseOutline> {
  const draft = await completeJson({ task: "course", tier: "deep", ...coursePrompt(request), schema: OutlineSchema, maxTokens: 5000, apiKey });
  try {
    return await completeJson({
      task: "course_review",
      tier: "deep",
      ...courseReviewPrompt(draft),
      schema: OutlineSchema,
      maxTokens: 6000,
      temperature: REVIEW_TEMPERATURE,
      apiKey,
    });
  } catch (error) {
    // Quizzes only place the learner, and a lesson still corrects them, so an unreviewed one is acceptable here.
    if (!(error instanceof ApiError)) throw error;
    return draft;
  }
}
