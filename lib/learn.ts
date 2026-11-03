import type { Course, CourseOutline, Lesson, ResumeProfile, Session, Skill, SkillProgress } from "./types";

// Passing is decided here, not by the model, so the same score always means the same thing.
export const PASS_SCORE = 70;
// Matches the bottom of the report's "competent" band.
export const INTERVIEW_WEAK_SCORE = 65;

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];
const MAX_SKILLS = 8;

const EMPTY: SkillProgress = { level: 0, weak: false, attempts: 0 };

const words = (value: string) => ` ${value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

function profileText(profile: ResumeProfile) {
  return words(
    [
      profile.headline,
      profile.summary,
      ...profile.skills,
      ...profile.experience.flatMap((job) => [job.title, job.org, ...job.highlights]),
      ...profile.projects.flatMap((project) => [project.name, project.description, ...project.tech]),
      ...profile.education,
    ].join(" | "),
  );
}

// The audit tells people what they cannot defend, so it may only quote words the resume really contains.
export function verifiedClaim(claim: string, profile?: ResumeProfile) {
  const wanted = words(claim);
  if (!profile || !wanted.trim()) return "";
  return profileText(profile).includes(wanted) ? claim : "";
}

const CATCH_ALL = /^(all|none|both|neither) of (the )?(above|these|them)\.?$/i;

function withoutCatchAll(quiz: Skill["quiz"]): Skill["quiz"] {
  const keep = quiz.options.map((option, index) => index === quiz.correct || !CATCH_ALL.test(option.trim()));
  if (keep.filter(Boolean).length < 2) return quiz;
  const options = quiz.options.filter((_, index) => keep[index]);
  return { ...quiz, options, correct: options.indexOf(quiz.options[quiz.correct]) };
}

function shuffled(quiz: Skill["quiz"], random: () => number): Skill["quiz"] {
  const order = quiz.options.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...quiz, options: order.map((index) => quiz.options[index]), correct: order.indexOf(quiz.correct) };
}

// Foundations first. Whatever is left in a cycle keeps its model order, and any prerequisite that does not
// come earlier is dropped, so the result can always be worked through from the top.
function foundationsFirst(skills: Skill[]) {
  const placed = new Set<string>();
  const ordered: Skill[] = [];
  let waiting = skills;
  while (waiting.length > 0) {
    const ready = waiting.filter((skill) => skill.prerequisites.every((id) => placed.has(id)));
    const batch = ready.length > 0 ? ready : [waiting[0]];
    batch.forEach((skill) => placed.add(skill.id));
    ordered.push(...batch);
    waiting = waiting.filter((skill) => !batch.includes(skill));
  }
  return ordered.map((skill, index) => {
    const earlier = new Set(ordered.slice(0, index).map((s) => s.id));
    return { ...skill, prerequisites: skill.prerequisites.filter((id) => earlier.has(id)) };
  });
}

// Model output is cleaned here, because ids end up in URLs and claims end up in front of the user.
export function normalizeOutline(outline: CourseOutline, profile?: ResumeProfile, random: () => number = Math.random): CourseOutline {
  const unique = outline.skills
    .filter((skill, index, all) => all.findIndex((s) => s.id === skill.id) === index)
    .slice(0, MAX_SKILLS);
  const known = new Set(unique.map((skill) => skill.id));
  const ordered = foundationsFirst(
    unique.map((skill) => ({
      ...skill,
      prerequisites: skill.prerequisites.filter((id) => id !== skill.id && known.has(id)),
    })),
  );
  const safeId = new Map(ordered.map((skill, index) => [skill.id, `s${index + 1}`]));
  return {
    title: outline.title,
    skills: ordered.map((skill) => ({
      ...skill,
      id: safeId.get(skill.id) as string,
      claim: verifiedClaim(skill.claim, profile),
      prerequisites: skill.prerequisites.map((id) => safeId.get(id) as string),
      quiz: shuffled(withoutCatchAll(skill.quiz), random),
    })),
  };
}

const COPY_RUN = 4;
// Above this share, the text is the lesson's rather than the learner's.
export const COPY_LIMIT = 0.5;

const runsOf = (text: string) => {
  const tokens = words(text).trim().split(" ").filter(Boolean);
  return tokens.slice(0, Math.max(0, tokens.length - COPY_RUN + 1)).map((_, i) => tokens.slice(i, i + COPY_RUN).join(" "));
};

export function lessonText(lesson: Lesson) {
  return [lesson.summary, ...lesson.explanation, lesson.example, ...lesson.pitfalls, ...lesson.keyPoints].join(" ");
}

// The share of an explanation's four-word runs that also appear in the lesson.
export function copiedShare(explanation: string, source: string) {
  const runs = runsOf(explanation);
  if (runs.length === 0) return 0;
  const known = new Set(runsOf(source));
  return runs.filter((run) => known.has(run)).length / runs.length;
}

export const progressOf = (course: Course, skillId: string) => course.progress[skillId] ?? EMPTY;

export type SkillState = "review" | "weak" | "new" | "placed" | "ready";

export const STATE_LABELS: Record<SkillState, string> = {
  review: "Review due",
  weak: "Needs work",
  new: "Not started",
  placed: "Quiz passed",
  ready: "Ready",
};

export function skillState(progress: SkillProgress, now: number): SkillState {
  if (progress.level > 0 && progress.dueAt !== undefined && progress.dueAt <= now) return "review";
  if (progress.weak) return "weak";
  if (progress.level > 0) return "ready";
  return progress.quiz === "correct" ? "placed" : "new";
}

export const statesOf = (course: Course, now: number) =>
  course.skills.map((skill) => ({ skill, state: skillState(progressOf(course, skill.id), now) }));

export function courseStats(course: Course, now: number) {
  const states = statesOf(course, now).map((entry) => entry.state);
  return {
    total: states.length,
    ready: states.filter((state) => state === "ready").length,
    due: states.filter((state) => state === "review").length,
  };
}

// Reviews come first so nothing decays, then the path in order, then skills only a quiz has vouched for.
export function nextSkill(course: Course, now: number): Skill | undefined {
  const entries = statesOf(course, now);
  const pick = (...states: SkillState[]) => entries.find((entry) => states.includes(entry.state))?.skill;
  return pick("review") ?? pick("weak", "new") ?? pick("placed");
}

const FOCUS_ORDER: SkillState[] = ["weak", "review", "ready", "placed", "new"];

// Skills an interview should press on, shakiest first.
export function focusSkills(course: Course, now: number) {
  return statesOf(course, now)
    .sort((a, b) => FOCUS_ORDER.indexOf(a.state) - FOCUS_ORDER.indexOf(b.state))
    .slice(0, MAX_SKILLS)
    .map(({ skill }) => ({ id: skill.id, name: skill.name }));
}

export type Verdict = "defended" | "shaky" | "unchecked";

export const VERDICT_LABELS: Record<Verdict, string> = {
  defended: "You can defend this",
  shaky: "You could not back this up yet",
  unchecked: "Not checked yet",
};

// A quiz pass stays unchecked: picking an option is not the same as explaining it to an interviewer.
export function claimAudit(course: Course) {
  return course.skills
    .filter((skill) => skill.claim)
    .map((skill) => {
      const progress = progressOf(course, skill.id);
      const verdict: Verdict = progress.weak ? "shaky" : progress.level > 0 ? "defended" : "unchecked";
      return { skill, verdict };
    });
}

const withProgress = (course: Course, skillId: string, patch: Partial<SkillProgress>, now: number): Course => ({
  ...course,
  updatedAt: now,
  progress: { ...course.progress, [skillId]: { ...progressOf(course, skillId), ...patch } },
});

export function applyQuiz(course: Course, answers: Record<string, number | "unsure" | undefined>, now: number): Course {
  const progress = { ...course.progress };
  for (const skill of course.skills) {
    const answer = answers[skill.id];
    if (answer === undefined) continue;
    const quiz = answer === "unsure" ? "unsure" : answer === skill.quiz.correct ? "correct" : "wrong";
    progress[skill.id] = { ...progressOf(course, skill.id), quiz, weak: quiz !== "correct" };
  }
  return { ...course, progress, quizzedAt: now, updatedAt: now };
}

export function applyCheck(course: Course, skillId: string, score: number, now: number): Course {
  const progress = progressOf(course, skillId);
  const attempts = progress.attempts + 1;
  if (score >= PASS_SCORE) {
    const level = Math.min(progress.level + 1, REVIEW_DAYS.length);
    return withProgress(course, skillId, { level, weak: false, attempts, lastScore: score, dueAt: now + REVIEW_DAYS[level - 1] * DAY_MS }, now);
  }
  return withProgress(course, skillId, { level: Math.max(0, progress.level - 1), weak: true, attempts, lastScore: score, dueAt: now }, now);
}

// A weak interview answer outranks an earlier pass, so the skill comes back up for review.
export function applyInterview(course: Course, session: Session, now: number) {
  const questions = session.report?.questions ?? [];
  const reopened: Skill[] = [];
  let updated = course;
  for (const question of session.plan.questions) {
    const review = questions.find((q) => q.id === question.id);
    const skill = course.skills.find((s) => s.id === question.skillId);
    if (!skill || !review?.assessed || review.score >= INTERVIEW_WEAK_SCORE) continue;
    if (!reopened.includes(skill)) reopened.push(skill);
    const progress = progressOf(updated, skill.id);
    if (progress.reopenedBy === session.id) continue;
    updated = withProgress(updated, skill.id, { level: Math.max(0, progress.level - 1), weak: true, dueAt: now, reopenedBy: session.id }, now);
  }
  return { course: updated, reopened: reopened.map((skill) => skill.name) };
}
