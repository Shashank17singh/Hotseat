import { z } from "zod";
import { DIFFICULTIES, INTERVIEW_TYPES, PERSONAS, QUESTION_COUNTS, SENIORITIES } from "./catalog";

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((item) => item.id) as [T[number]["id"], ...T[number]["id"][]];

const text = (max: number) => z.string().trim().max(max);

export const LIMITS = {
  answerChars: 6000,
  codeChars: 8000,
  jobDescriptionChars: 8000,
  resumeChars: 20000,
  topicChars: 2000,
  resumeBytes: 4 * 1024 * 1024,
  // Vercel rejects request bodies over 4.5 MB; at 24 kbit/s this is about 22 minutes of speech.
  audioBytes: 4 * 1024 * 1024,
} as const;

export const ConfigSchema = z.object({
  role: text(120).min(2),
  seniority: z.enum(ids(SENIORITIES)),
  type: z.enum(ids(INTERVIEW_TYPES)),
  difficulty: z.enum(ids(DIFFICULTIES)),
  persona: z.enum(ids(PERSONAS)),
  questionCount: z.number().refine((n) => (QUESTION_COUNTS as readonly number[]).includes(n)),
  company: text(120).optional(),
  jobDescription: text(LIMITS.jobDescriptionChars).optional(),
});
export type InterviewConfig = z.infer<typeof ConfigSchema>;

const stringList = (maxItems: number, maxChars: number) =>
  z.array(text(maxChars)).max(maxItems).catch([]);

export const ProfileSchema = z.object({
  name: text(120).catch(""),
  headline: text(200).catch(""),
  summary: text(800).catch(""),
  skills: stringList(40, 60),
  experience: z
    .array(
      z.object({
        title: text(120).catch(""),
        org: text(120).catch(""),
        period: text(60).catch(""),
        highlights: stringList(6, 240),
      }),
    )
    .max(10)
    .catch([]),
  projects: z
    .array(
      z.object({
        name: text(120).catch(""),
        description: text(300).catch(""),
        tech: stringList(12, 40),
      }),
    )
    .max(10)
    .catch([]),
  education: stringList(6, 200),
});
export type ResumeProfile = z.infer<typeof ProfileSchema>;

export const QuestionSchema = z.object({
  id: z.string().min(1).max(20),
  question: text(600).min(5),
  competency: text(60).min(2),
  hint: text(300).catch("Take a moment and structure your answer before you start."),
  signals: z.array(text(160)).max(6).catch([]),
  answerFormat: z.enum(["spoken", "code"]).catch("spoken"),
  // Set on interviews started from a course, so a weak answer can send that skill back for review.
  skillId: z.string().max(20).optional().catch(undefined),
});
export type PlannedQuestion = z.infer<typeof QuestionSchema>;

export const PlanSchema = z.object({
  greeting: text(400).min(5),
  questions: z.array(QuestionSchema).min(1).max(8),
});
export type InterviewPlan = z.infer<typeof PlanSchema>;

export const TurnReplySchema = z.object({
  acknowledgement: text(300).catch(""),
  action: z.enum(["follow_up", "next"]).catch("next"),
  followUp: text(400).catch(""),
  nextQuestion: text(600).catch(""),
  nextHint: text(300).catch(""),
  nextSignals: z.array(text(160)).max(6).catch([]),
});
export type TurnReply = z.infer<typeof TurnReplySchema>;

export const AnswerMetricsSchema = z.object({
  mode: z.enum(["voice", "typed"]),
  seconds: z.number().min(0),
  words: z.number().min(0),
  wordsPerMinute: z.number().min(0),
  fillers: z.number().min(0),
  fillerWords: z.record(z.string(), z.number()),
  longestPauseSec: z.number().min(0),
  silenceRatio: z.number().min(0).max(1),
  facingRatio: z.number().min(0).max(1).optional(),
});
export type AnswerMetrics = z.infer<typeof AnswerMetricsSchema>;

export const TurnSchema = z.object({
  id: z.string().max(40),
  questionId: z.string().max(20),
  kind: z.enum(["main", "follow_up"]),
  prompt: text(1200),
  answer: text(LIMITS.answerChars).default(""),
  code: text(LIMITS.codeChars).optional(),
  skipped: z.boolean().default(false),
  hintUsed: z.boolean().default(false),
  metrics: AnswerMetricsSchema.optional(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const LlmReportSchema = z.object({
  summary: text(900).catch(""),
  strengths: stringList(5, 240),
  improvements: stringList(5, 240),
  competencies: z
    .array(
      z.object({
        name: text(60),
        score: z.coerce.number().min(0).max(100).catch(0),
        evidence: text(240).catch(""),
      }),
    )
    .max(8)
    .catch([]),
  questions: z
    .array(
      z.object({
        id: z.string().max(20),
        score: z.coerce.number().min(0).max(100).catch(0),
        whatWorked: text(400).catch(""),
        whatToImprove: text(400).catch(""),
        betterAnswer: text(1200).catch(""),
      }),
    )
    .max(8),
  nextSteps: stringList(5, 240),
});
export type LlmReport = z.infer<typeof LlmReportSchema>;

export type QuestionReview = LlmReport["questions"][number] & { assessed: boolean };

export type Report = Omit<LlmReport, "questions"> & {
  overall: number;
  verdict: string;
  questions: QuestionReview[];
};

export const TurnRequestSchema = z.object({
  config: ConfigSchema,
  question: z.string().max(600),
  signals: z.array(z.string().max(160)).max(6).default([]),
  exchange: z.array(TurnSchema).min(1).max(6),
  nextQuestion: z.string().max(600).optional(),
  // Spoken questions are rewritten to build on the conversation; coding exercises stay as planned.
  adaptNext: z.boolean().default(false),
  earlier: z
    .array(z.object({ question: z.string().max(1200), answer: z.string().max(800) }))
    .max(12)
    .default([]),
  allowFollowUp: z.boolean(),
});
export type TurnRequest = z.infer<typeof TurnRequestSchema>;

export const PlanRequestSchema = z.object({
  config: ConfigSchema,
  profile: ProfileSchema.optional(),
  avoid: z.array(z.string().max(600)).max(40).default([]),
  focus: z.array(z.object({ id: z.string().max(20), name: z.string().max(80) })).max(8).default([]),
});

export const ReportRequestSchema = z.object({
  config: ConfigSchema,
  questions: z.array(QuestionSchema).min(1).max(8),
  turns: z.array(TurnSchema).min(1).max(40),
});
export type ReportRequest = z.infer<typeof ReportRequestSchema>;

export type Session = {
  id: string;
  createdAt: number;
  updatedAt: number;
  config: InterviewConfig;
  profile?: ResumeProfile;
  plan: InterviewPlan;
  turns: Turn[];
  report?: Report;
  status: "in_progress" | "awaiting_report" | "complete";
  courseId?: string;
  // Names of the course skills this interview sent back for review.
  reopened?: string[];
};

const QuizSchema = z
  .object({
    question: text(400).min(5),
    options: z.array(text(240).min(1)).min(2).max(4),
    correct: z.coerce.number().int().min(0),
    explanation: text(400).catch(""),
  })
  .refine((quiz) => quiz.correct < quiz.options.length);

export const SkillSchema = z.object({
  id: z.coerce.string().max(20),
  name: text(80).min(2),
  // The resume wording this skill defends. Empty for skills the resume does not claim.
  claim: text(240).catch(""),
  why: text(300).catch(""),
  prerequisites: z.array(z.coerce.string().max(20)).max(8).catch([]),
  quiz: QuizSchema,
});
export type Skill = z.infer<typeof SkillSchema>;

export const OutlineSchema = z.object({
  title: text(120).min(2),
  // A model that fumbles one quiz should cost that skill, not the whole course.
  skills: z
    .array(z.unknown())
    .transform((list) => list.flatMap((item) => {
      const skill = SkillSchema.safeParse(item);
      return skill.success ? [skill.data] : [];
    }).slice(0, 12))
    .refine((skills) => skills.length > 0),
});
export type CourseOutline = z.infer<typeof OutlineSchema>;

export const LessonSchema = z.object({
  summary: text(500).min(5),
  explanation: z.array(text(1200).min(1)).min(1).max(6),
  example: text(1200).catch(""),
  code: text(2000).catch(""),
  pitfalls: stringList(5, 240),
  interviewQuestions: stringList(5, 240),
  checkPrompt: text(300).min(5),
  keyPoints: z.array(text(200).min(1)).min(1).max(6),
  sources: stringList(4, 120),
  // False when the fact-check could not run, so the page can say so. Lessons saved before it existed have no value.
  reviewed: z.boolean().optional(),
  // The documentation the fact-check read, when it found any.
  checkedAgainst: z.string().max(120).optional(),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const LessonReviewSchema = z.object({
  problems: stringList(10, 300),
  lesson: LessonSchema,
});

export const CheckResultSchema = z.object({
  score: z.coerce.number().min(0).max(100).catch(0),
  feedback: text(600).catch(""),
  covered: stringList(6, 200),
  missed: stringList(6, 200),
  reteach: text(1200).catch(""),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const CourseRequestSchema = z
  .object({
    role: text(120).optional(),
    seniority: z.enum(ids(SENIORITIES)),
    topics: text(LIMITS.topicChars).optional(),
    jobDescription: text(LIMITS.jobDescriptionChars).optional(),
    profile: ProfileSchema.optional(),
  })
  .refine((request) => request.profile || request.topics);
export type CourseRequest = z.infer<typeof CourseRequestSchema>;

export const LessonRequestSchema = z.object({
  skill: SkillSchema.omit({ quiz: true }),
  builtOn: z.array(z.string().max(80)).max(8).default([]),
  role: text(120).optional(),
  seniority: z.enum(ids(SENIORITIES)),
  profile: ProfileSchema.optional(),
});
export type LessonRequest = z.infer<typeof LessonRequestSchema>;

export const CheckRequestSchema = z.object({
  skill: z.string().max(80),
  prompt: z.string().max(300),
  keyPoints: z.array(z.string().max(200)).min(1).max(6),
  explanation: text(LIMITS.answerChars).min(1),
});
export type CheckRequest = z.infer<typeof CheckRequestSchema>;

export type SkillProgress = {
  quiz?: "correct" | "wrong" | "unsure";
  // Leitner box: 0 has never been explained back, and each pass moves it up and spaces the next review out.
  level: number;
  weak: boolean;
  attempts: number;
  dueAt?: number;
  lastScore?: number;
  reopenedBy?: string;
};

export type Course = CourseOutline & {
  id: string;
  createdAt: number;
  updatedAt: number;
  request: CourseRequest;
  quizzedAt?: number;
  progress: Record<string, SkillProgress>;
  lessons: Record<string, Lesson>;
};

export type ApiErrorBody = {
  code: "no_key" | "rate_limited" | "upstream" | "invalid" | "too_large" | "unreadable" | "unknown";
  message: string;
  retryAfterSec?: number;
};
