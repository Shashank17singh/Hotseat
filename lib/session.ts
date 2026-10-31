import { difficultyOf } from "./catalog";
import type { AnswerMetrics, PlannedQuestion, Session, Turn, TurnReply, TurnRequest } from "./types";

export type Phase =
  | "ready" // waiting for the candidate to start
  | "asking" // the interviewer is speaking
  | "answering" // the candidate is recording or typing
  | "reviewing" // the candidate checks the transcript before sending
  | "thinking" // waiting for the interviewer's reply
  | "finished";

const EARLIER_TURNS = 8;
const EARLIER_ANSWER_CHARS = 800;
const SKIP_REPLY: TurnReply = {
  acknowledgement: "That's fine, let's move on.",
  action: "next",
  followUp: "",
  nextQuestion: "",
  nextHint: "",
  nextSignals: [],
};

export type RoomState = {
  session: Session;
  phase: Phase;
  questionIndex: number;
  // What the interviewer is saying now. Differs from the turn prompt when an acknowledgement leads in.
  spoken: string;
  draft: string;
  draftCode: string;
  draftMetrics?: AnswerMetrics;
  hintShown: boolean;
  error?: string;
};

export type RoomAction =
  | { type: "begin" }
  | { type: "spoken" }
  | { type: "answer_stopped"; text: string; metrics?: AnswerMetrics }
  | { type: "start_answer" }
  | { type: "edit_draft"; text: string }
  | { type: "edit_code"; code: string }
  | { type: "show_hint" }
  | { type: "submit" }
  | { type: "skip" }
  | { type: "reply"; reply: TurnReply }
  | { type: "end" }
  | { type: "retry" }
  | { type: "fail"; message: string };

export function initialState(session: Session): RoomState {
  const last = session.turns.at(-1);
  // A reload mid-interview returns to the unanswered turn instead of losing the session.
  const answered = last ? Boolean(last.answer || last.skipped) : false;
  const questionIndex = last
    ? Math.max(0, session.plan.questions.findIndex((q) => q.id === last.questionId))
    : 0;
  const base = { session, questionIndex, draft: "", draftCode: "", hintShown: false };

  if (session.status !== "in_progress") return { ...base, phase: "finished", spoken: "" };
  if (!last) return { ...base, phase: "ready", spoken: session.plan.greeting };
  if (!answered) return { ...base, phase: "ready", spoken: last.prompt };
  return { ...base, phase: "thinking", spoken: "" };
}

export function currentQuestion(state: RoomState): PlannedQuestion {
  return state.session.plan.questions[state.questionIndex];
}

export function currentTurn(state: RoomState): Turn | undefined {
  return state.session.turns.at(-1);
}

export function followUpsUsed(session: Session, questionId: string) {
  return session.turns.filter((t) => t.questionId === questionId && t.kind === "follow_up").length;
}

export function canFollowUp(session: Session, questionId: string) {
  return followUpsUsed(session, questionId) < difficultyOf(session.config.difficulty).maxFollowUps;
}

export function buildTurnRequest(state: RoomState): TurnRequest {
  const { session, questionIndex } = state;
  const question = session.plan.questions[questionIndex];
  const next = session.plan.questions[questionIndex + 1];
  return {
    config: session.config,
    question: question.question,
    signals: question.signals,
    exchange: session.turns.filter((t) => t.questionId === question.id),
    nextQuestion: next?.question,
    adaptNext: next?.answerFormat === "spoken",
    earlier: session.turns
      .filter((t) => t.questionId !== question.id && t.answer)
      .slice(-EARLIER_TURNS)
      .map((t) => ({ question: t.prompt, answer: t.answer.slice(0, EARLIER_ANSWER_CHARS) })),
    allowFollowUp: canFollowUp(session, question.id),
  };
}

function makeTurn(session: Session, question: PlannedQuestion, kind: Turn["kind"], prompt: string): Turn {
  return {
    id: `${question.id}-${session.turns.length + 1}`,
    questionId: question.id,
    kind,
    prompt,
    answer: "",
    skipped: false,
    hintUsed: false,
  };
}

function patchLastTurn(session: Session, patch: Partial<Turn>): Session {
  const turns = session.turns.slice();
  turns[turns.length - 1] = { ...turns[turns.length - 1], ...patch };
  return { ...session, turns, updatedAt: Date.now() };
}

function clearDraft() {
  return { draft: "", draftCode: "", draftMetrics: undefined, hintShown: false };
}

export function reduce(state: RoomState, action: RoomAction): RoomState {
  const { session } = state;

  switch (action.type) {
    case "begin": {
      const question = session.plan.questions[state.questionIndex];
      // Resuming: the unanswered turn already exists, so only re-read it aloud.
      const last = session.turns.at(-1);
      if (last && !last.answer && !last.skipped) {
        return { ...state, phase: "asking", spoken: last.prompt, error: undefined };
      }
      const turn = makeTurn(session, question, "main", question.question);
      return {
        ...state,
        phase: "asking",
        spoken: `${session.plan.greeting} ${question.question}`,
        session: { ...session, turns: [...session.turns, turn], updatedAt: Date.now() },
        error: undefined,
      };
    }

    case "spoken":
      return state.phase === "asking" ? { ...state, phase: "answering" } : state;

    case "start_answer":
      return { ...state, phase: "answering", draft: "", draftMetrics: undefined, error: undefined };

    case "answer_stopped":
      return { ...state, phase: "reviewing", draft: action.text, draftMetrics: action.metrics };

    case "edit_draft":
      return { ...state, draft: action.text };

    case "edit_code":
      return { ...state, draftCode: action.code };

    case "show_hint":
      return {
        ...state,
        hintShown: true,
        session: patchLastTurn(session, { hintUsed: true }),
      };

    case "submit": {
      if (!state.draft.trim() && !state.draftCode.trim()) {
        return { ...state, error: "There is no answer to send yet. Record or type one, or skip the question." };
      }
      return {
        ...state,
        phase: "thinking",
        session: patchLastTurn(session, {
          answer: state.draft.trim(),
          code: state.draftCode.trim() || undefined,
          metrics: state.draftMetrics,
        }),
        error: undefined,
      };
    }

    // A skip has no answer to react to, so it moves on without asking the model to respond to nothing.
    case "skip":
      return applyReply({ ...state, session: patchLastTurn(session, { skipped: true }) }, SKIP_REPLY);

    case "reply":
      return applyReply(state, action.reply);

    case "end":
      return {
        ...state,
        ...clearDraft(),
        phase: "finished",
        spoken: "",
        session: {
          ...session,
          status: "awaiting_report",
          turns: session.turns.filter((t) => t.answer || t.code || t.skipped),
          updatedAt: Date.now(),
        },
        error: undefined,
      };

    case "retry":
      return { ...state, error: undefined };

    case "fail":
      return { ...state, error: action.message };
  }
}

function applyReply(state: RoomState, reply: TurnReply): RoomState {
  const { session, questionIndex } = state;
  const question = session.plan.questions[questionIndex];
  const followUp = reply.followUp.trim();

  // The client holds the follow-up cap, so a model that ignores the instruction cannot run the interview long.
  if (reply.action === "follow_up" && followUp && canFollowUp(session, question.id)) {
    const turn = makeTurn(session, question, "follow_up", followUp);
    return {
      ...state,
      ...clearDraft(),
      phase: "asking",
      spoken: [reply.acknowledgement, followUp].filter(Boolean).join(" "),
      session: { ...session, turns: [...session.turns, turn], updatedAt: Date.now() },
      error: undefined,
    };
  }

  const next = session.plan.questions[questionIndex + 1];
  if (!next) {
    return {
      ...state,
      ...clearDraft(),
      phase: "finished",
      spoken: "",
      session: { ...session, status: "awaiting_report", updatedAt: Date.now() },
      error: undefined,
    };
  }

  const asked = adaptQuestion(next, reply);
  const questions = session.plan.questions.map((q) => (q.id === asked.id ? asked : q));
  const turn = makeTurn(session, asked, "main", asked.question);
  return {
    ...state,
    ...clearDraft(),
    phase: "asking",
    questionIndex: questionIndex + 1,
    spoken: [reply.acknowledgement, asked.question].filter(Boolean).join(" "),
    session: {
      ...session,
      plan: { ...session.plan, questions },
      turns: [...session.turns, turn],
      updatedAt: Date.now(),
    },
    error: undefined,
  };
}

function adaptQuestion(planned: PlannedQuestion, reply: TurnReply): PlannedQuestion {
  const question = reply.nextQuestion.trim();
  if (planned.answerFormat !== "spoken" || question.length < 5) return planned;
  return {
    ...planned,
    question,
    hint: reply.nextHint.trim() || planned.hint,
    signals: reply.nextSignals.length ? reply.nextSignals : planned.signals,
  };
}
