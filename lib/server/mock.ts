import type { Task } from "./llm";

// Scripted replies for LLM_PROVIDER=mock, used by the test suites and for running the UI without a key.
export function mockCompletion(task: Task, user: string): unknown {
  switch (task) {
    case "profile":
      return {
        name: "Test Candidate",
        headline: "Software engineer",
        summary: "Builds backend services.",
        skills: ["TypeScript", "PostgreSQL"],
        experience: [{ title: "Engineer", org: "Example Co", period: "2023 to now", highlights: ["Shipped a billing service"] }],
        projects: [{ name: "Ledger", description: "A double-entry ledger", tech: ["Go"] }],
        education: ["BTech, Computer Science"],
      };
    case "plan": {
      const count = Number(user.match(/Plan exactly (\d+) questions/)?.[1] ?? 3);
      return {
        greeting: "Hello, I'm Maya, and I'll be running this practice interview.",
        questions: Array.from({ length: count }, (_, i) => ({
          id: `q${i + 1}`,
          question: i === 1 ? "Write a function that reverses a string." : `Tell me about a hard problem you solved, part ${i + 1}.`,
          competency: i === 1 ? "Coding" : "Problem solving",
          hint: "Describe the situation, your action and the result.",
          signals: ["A concrete example", "A measurable result"],
          answerFormat: i === 1 ? "code" : "spoken",
        })),
      };
    }
    case "turn": {
      const canFollow = !user.includes("Do not ask a follow-up");
      return {
        acknowledgement: "Thank you.",
        action: canFollow && user.includes("part 1") ? "follow_up" : "next",
        followUp: "What was the measurable result?",
      };
    }
    case "report": {
      const ids = [...user.matchAll(/Question (q\d+) \[/g)].map((m) => m[1]);
      return {
        summary: "You gave concrete examples but left results unquantified.",
        strengths: ["Clear structure in your first answer"],
        improvements: ["State the measurable outcome of your work"],
        competencies: [{ name: "Problem solving", score: 72, evidence: "You walked through your approach step by step." }],
        questions: ids.map((id, i) => ({
          id,
          score: 80 - i * 10,
          whatWorked: "You named the problem clearly.",
          whatToImprove: "Add a number to the outcome.",
          betterAnswer: "The latency problem was hurting checkout, so I added a cache and cut p95 by half.",
        })),
        nextSteps: ["Rewrite two stories with a measurable result"],
      };
    }
  }
}

export function mockTranscript() {
  return "So, um, I led the migration of our billing service, and you know, it took about three months.";
}
