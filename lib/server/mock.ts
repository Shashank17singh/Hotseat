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
      const focus = [...user.matchAll(/^\[(s\d+)\] /gm)].map((m) => m[1]);
      return {
        greeting: "Hello, I'm Maya, and I'll be running this practice interview.",
        questions: Array.from({ length: count }, (_, i) => ({
          id: `q${i + 1}`,
          skillId: focus.length ? focus[i % focus.length] : undefined,
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
        action: canFollow && /Main question: .*part 1/.test(user) ? "follow_up" : "next",
        followUp: "What was the measurable result?",
        nextQuestion: user.includes("write the next main question") ? "Building on what you said, how would you test that approach?" : "",
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
    case "course": {
      const quiz = (topic: string) => ({
        question: `Which statement about ${topic} is true?`,
        options: ["The correct statement", "A wrong statement", "Another wrong statement"],
        correct: 0,
        explanation: `Why that statement about ${topic} holds.`,
      });
      return {
        title: "Backend interview foundations",
        skills: [
          { id: "indexes", name: "Database indexes", claim: "PostgreSQL", why: "Interviewers probe what you listed.", prerequisites: [], quiz: quiz("indexes") },
          { id: "billing", name: "Idempotent billing", claim: "Shipped a billing service", why: "Retries can charge twice.", prerequisites: ["indexes"], quiz: quiz("billing") },
          { id: "queues", name: "Message queues", claim: "Kafka consumer groups", why: "Common in system design rounds.", prerequisites: ["billing"], quiz: quiz("queues") },
        ],
      };
    }
    case "lesson": {
      const skill = user.match(/<data name="skill">\n(.*)\n/)?.[1] ?? "This skill";
      return {
        summary: `${skill}, explained from the beginning.`,
        explanation: ["First, what it is and the problem it solves.", "Then, how it works underneath."],
        example: "In your Ledger project, this would keep two writes from being applied twice.",
        code: "SELECT 1;",
        pitfalls: ["Naming the tool without saying why you chose it"],
        interviewQuestions: ["What breaks if you remove it?"],
        checkPrompt: "Explain this to a teammate who has never met it.",
        keyPoints: ["What it is", "Why it matters"],
        sources: ["Official documentation"],
      };
    }
    case "course_review":
      return JSON.parse(user.match(/<data name="draft">\n(.*)\n<\/data>/)?.[1] ?? "{}");
    case "lesson_review":
      return { problems: [], lesson: JSON.parse(user.match(/<data name="draft">\n(.*)\n<\/data>/)?.[1] ?? "{}") };
    case "check": {
      const explanation = user.match(/<data name="explanation">\n([\s\S]*?)\n<\/data>/)?.[1] ?? "";
      const strong = explanation.includes("because");
      return {
        score: strong ? 85 : 40,
        feedback: strong ? "You gave the reason, not only the name." : "You named it but did not say why it matters.",
        covered: ["What it is"],
        missed: strong ? [] : ["Why it matters"],
        reteach: strong ? "" : "Think of it as the reason the work is safe to repeat.",
      };
    }
  }
}

export function mockTranscript() {
  return "So, um, I led the migration of our billing service, and you know, it took about three months.";
}
