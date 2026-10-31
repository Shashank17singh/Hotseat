import { describe, expect, it } from "vitest";
import { buildTurnRequest, canFollowUp, initialState, reduce } from "@/lib/session";
import type { RoomState } from "@/lib/session";
import { config, session } from "./fixtures";

const reply = { nextQuestion: "", nextHint: "", nextSignals: [] };
const next = { ...reply, acknowledgement: "Thanks.", action: "next", followUp: "" } as const;
const follow = { ...reply, acknowledgement: "Thanks.", action: "follow_up", followUp: "Why that approach?" } as const;

function answer(state: RoomState, text = "My answer") {
  const stopped = reduce(state, { type: "answer_stopped", text });
  return reduce(stopped, { type: "submit" });
}

const begun = () => reduce(initialState(session()), { type: "begin" });

describe("interview flow", () => {
  it("speaks the greeting with the first question", () => {
    const state = begun();
    expect(state.phase).toBe("asking");
    expect(state.spoken).toBe("Hello there. Question number 1?");
    expect(state.session.turns).toHaveLength(1);
  });

  it("moves to answering when speech ends, and ignores a stale end", () => {
    const state = reduce(begun(), { type: "spoken" });
    expect(state.phase).toBe("answering");
    expect(reduce({ ...state, phase: "thinking" }, { type: "spoken" }).phase).toBe("thinking");
  });

  it("refuses an empty answer", () => {
    const state = reduce(reduce(begun(), { type: "answer_stopped", text: "  " }), { type: "submit" });
    expect(state.phase).toBe("reviewing");
    expect(state.error).toBeDefined();
  });

  it("accepts code with no spoken answer", () => {
    let state = reduce(begun(), { type: "edit_code", code: "return 1" });
    state = reduce(state, { type: "answer_stopped", text: "" });
    state = reduce(state, { type: "submit" });
    expect(state.session.turns[0].code).toBe("return 1");
    expect(state.phase).toBe("thinking");
  });

  it("walks every question and then finishes", () => {
    let state = begun();
    for (let i = 0; i < 2; i += 1) {
      state = reduce(answer(state), { type: "reply", reply: next });
      expect(state.questionIndex).toBe(i + 1);
      expect(state.spoken).toBe(`Thanks. Question number ${i + 2}?`);
    }
    state = reduce(answer(state), { type: "reply", reply: next });
    expect(state.phase).toBe("finished");
    expect(state.session.status).toBe("awaiting_report");
  });

  it("clears the draft between questions", () => {
    const state = reduce(answer(reduce(begun(), { type: "edit_code", code: "x" })), { type: "reply", reply: next });
    expect(state.draft).toBe("");
    expect(state.draftCode).toBe("");
  });
});

describe("follow-ups", () => {
  it("asks a follow-up on the same question", () => {
    const state = reduce(answer(begun()), { type: "reply", reply: follow });
    expect(state.questionIndex).toBe(0);
    expect(state.session.turns.at(-1)?.kind).toBe("follow_up");
    expect(state.spoken).toBe("Thanks. Why that approach?");
  });

  it("holds the cap for the difficulty even if the model keeps asking", () => {
    let state = reduce(answer(begun()), { type: "reply", reply: follow });
    state = reduce(answer(state), { type: "reply", reply: follow });
    expect(state.questionIndex).toBe(1);
    expect(state.session.turns.filter((t) => t.kind === "follow_up")).toHaveLength(1);
  });

  it("allows more follow-ups on harder interviews", () => {
    const hard = session({ config: { ...config, difficulty: "bar_raiser" } });
    let state = reduce(initialState(hard), { type: "begin" });
    for (let i = 0; i < 3; i += 1) {
      expect(canFollowUp(state.session, "q1")).toBe(true);
      state = reduce(answer(state), { type: "reply", reply: follow });
    }
    expect(canFollowUp(state.session, "q1")).toBe(false);
  });

  it("treats a follow-up with no text as moving on", () => {
    const state = reduce(answer(begun()), { type: "reply", reply: { ...follow, followUp: " " } });
    expect(state.questionIndex).toBe(1);
  });

  it("tells the server when no follow-up is allowed", () => {
    const state = reduce(answer(begun()), { type: "reply", reply: follow });
    expect(buildTurnRequest(answer(state)).allowFollowUp).toBe(false);
  });
});

describe("questions that build on the conversation", () => {
  const adapted = { ...next, nextQuestion: "You mentioned caching. How did you invalidate it?", nextHint: "Think about staleness.", nextSignals: ["Names a strategy"] };

  it("asks the rewritten question and stores it for the report", () => {
    const state = reduce(answer(begun()), { type: "reply", reply: adapted });
    expect(state.spoken).toBe("Thanks. You mentioned caching. How did you invalidate it?");
    expect(state.session.turns.at(-1)?.prompt).toBe(adapted.nextQuestion);
    expect(state.session.plan.questions[1]).toMatchObject({ id: "q2", question: adapted.nextQuestion, hint: "Think about staleness.", signals: ["Names a strategy"] });
  });

  it("keeps the planned question when no rewrite comes back", () => {
    const state = reduce(answer(begun()), { type: "reply", reply: next });
    expect(state.session.plan.questions[1].question).toBe("Question number 2?");
  });

  it("never rewrites a coding exercise", () => {
    const plan = session().plan;
    const coding = session({ plan: { ...plan, questions: plan.questions.map((q, i) => (i === 1 ? { ...q, answerFormat: "code" as const } : q)) } });
    const state = reduce(answer(reduce(initialState(coding), { type: "begin" })), { type: "reply", reply: adapted });
    expect(state.session.plan.questions[1].question).toBe("Question number 2?");
    expect(buildTurnRequest(answer(reduce(initialState(coding), { type: "begin" }))).adaptNext).toBe(false);
  });

  it("sends earlier answers, but not the current question's, as context", () => {
    const moved = reduce(answer(begun(), "I built a cache"), { type: "reply", reply: next });
    const request = buildTurnRequest(answer(moved, "Second answer"));
    expect(request.earlier).toEqual([{ question: "Question number 1?", answer: "I built a cache" }]);
    expect(request.adaptNext).toBe(true);
  });

  it("does not ask for a next question at the end", () => {
    let state = begun();
    for (let i = 0; i < 2; i += 1) state = reduce(answer(state), { type: "reply", reply: next });
    expect(buildTurnRequest(answer(state)).nextQuestion).toBeUndefined();
  });
});

describe("skips, hints and ending early", () => {
  it("moves straight on after a skip, with nothing for the model to react to", () => {
    const state = reduce(reduce(begun(), { type: "spoken" }), { type: "skip" });
    expect(state.session.turns[0].skipped).toBe(true);
    expect(state.phase).toBe("asking");
    expect(state.questionIndex).toBe(1);
    expect(state.spoken).toBe("That's fine, let's move on. Question number 2?");
  });

  it("finishes when the last question is skipped", () => {
    let state = begun();
    for (let i = 0; i < 3; i += 1) state = reduce(state, { type: "skip" });
    expect(state.phase).toBe("finished");
  });

  it("marks hint use on the turn", () => {
    expect(reduce(begun(), { type: "show_hint" }).session.turns[0].hintUsed).toBe(true);
  });

  it("drops the unanswered turn when ending early", () => {
    let state = reduce(answer(begun()), { type: "reply", reply: next });
    state = reduce(state, { type: "end" });
    expect(state.session.turns).toHaveLength(1);
    expect(state.phase).toBe("finished");
  });

  it("keeps an error until retry", () => {
    const failed = reduce(answer(begun()), { type: "fail", message: "Nope" });
    expect(failed.error).toBe("Nope");
    expect(reduce(failed, { type: "retry" }).error).toBeUndefined();
  });
});

describe("resuming after a reload", () => {
  it("re-reads the unanswered question without adding a turn", () => {
    const saved = begun().session;
    const resumed = initialState(saved);
    expect(resumed.phase).toBe("ready");
    const state = reduce(resumed, { type: "begin" });
    expect(state.session.turns).toHaveLength(1);
    expect(state.spoken).toBe("Question number 1?");
  });

  it("asks for the reply when the last answer was already sent", () => {
    const saved = answer(begun()).session;
    expect(initialState(saved).phase).toBe("thinking");
  });

  it("returns to the right question", () => {
    const saved = reduce(answer(begun()), { type: "reply", reply: next }).session;
    expect(initialState(saved).questionIndex).toBe(1);
  });

  it("does not reopen a finished session", () => {
    expect(initialState(session({ status: "complete" })).phase).toBe("finished");
  });
});
