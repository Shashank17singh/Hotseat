export const ROLE_GROUPS = [
  {
    label: "Engineering",
    roles: [
      "Software Engineer",
      "Frontend Engineer",
      "Backend Engineer",
      "Full Stack Engineer",
      "Mobile Engineer",
      "DevOps / SRE",
      "QA / Test Engineer",
      "Security Engineer",
    ],
  },
  {
    label: "Data and AI",
    roles: ["Data Scientist", "Data Analyst", "Data Engineer", "Machine Learning Engineer"],
  },
  {
    label: "Product and design",
    roles: ["Product Manager", "Product Designer", "Business Analyst", "Project Manager"],
  },
  {
    label: "Business",
    roles: [
      "Marketing Manager",
      "Sales Representative",
      "Customer Success Manager",
      "Finance Analyst",
      "HR Generalist",
      "Management Consultant",
    ],
  },
] as const;

export const SENIORITIES = [
  { id: "student", label: "Intern or fresher" },
  { id: "junior", label: "Junior" },
  { id: "mid", label: "Mid-level" },
  { id: "senior", label: "Senior" },
  { id: "lead", label: "Lead or manager" },
] as const;

export const INTERVIEW_TYPES = [
  { id: "mixed", label: "Mixed", detail: "A realistic blend of everything below" },
  { id: "behavioral", label: "Behavioural", detail: "Past situations, judgement and teamwork" },
  { id: "technical", label: "Technical", detail: "Role knowledge, with code where it fits" },
  { id: "system_design", label: "System design", detail: "Architecture and trade-offs" },
  { id: "screening", label: "HR screening", detail: "Motivation, fit and expectations" },
] as const;

export const DIFFICULTIES = [
  { id: "easy", label: "Easy", detail: "Warm-up questions, one gentle follow-up", heat: 2, maxFollowUps: 1, targetSec: 90 },
  { id: "medium", label: "Medium", detail: "A typical first-round interview", heat: 3, maxFollowUps: 1, targetSec: 120 },
  { id: "hard", label: "Hard", detail: "Probes depth and challenges your claims", heat: 4, maxFollowUps: 2, targetSec: 150 },
  { id: "bar_raiser", label: "Bar raiser", detail: "Final-round pressure, no easy marks", heat: 5, maxFollowUps: 3, targetSec: 180 },
] as const;

export const PERSONAS = [
  { id: "friendly", label: "Friendly", detail: "Warm and encouraging" },
  { id: "neutral", label: "Neutral", detail: "Professional and even" },
  { id: "tough", label: "Tough", detail: "Direct and hard to impress" },
] as const;

export const QUESTION_COUNTS = [3, 5, 8] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number]["id"];
export type Difficulty = (typeof DIFFICULTIES)[number]["id"];
export type Persona = (typeof PERSONAS)[number]["id"];
export type Seniority = (typeof SENIORITIES)[number]["id"];

export function difficultyOf(id: Difficulty) {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

export function labelOf<T extends { id: string; label: string }>(list: readonly T[], id: string) {
  return list.find((item) => item.id === id)?.label ?? id;
}
