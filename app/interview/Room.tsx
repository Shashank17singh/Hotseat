"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LEVEL_INTERVAL_MS, useRecorder } from "@/hooks/useRecorder";
import { mediaMessage, useLevel, useMedia } from "@/hooks/useMedia";
import { usePresence } from "@/hooks/usePresence";
import { errorMessage } from "@/components/Notice";
import { nextTurn, transcribeAudio } from "@/lib/api-client";
import { difficultyOf } from "@/lib/catalog";
import { buildMetrics } from "@/lib/metrics";
import { buildTurnRequest, currentQuestion, currentTurn, initialState, reduce } from "@/lib/session";
import type { Phase } from "@/lib/session";
import { speak, startCaptions } from "@/lib/speech";
import { readSettings, saveClip, saveSession } from "@/lib/storage";
import { LIMITS } from "@/lib/types";
import type { Session } from "@/lib/types";

const STATE_LABEL: Record<Phase, string> = {
  ready: "Ready when you are",
  asking: "Interviewer speaking",
  answering: "Your turn",
  reviewing: "Check your answer",
  thinking: "Interviewer thinking",
  finished: "Interview finished",
};

function clock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function Room({ session }: { session: Session }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reduce, session, initialState);
  const [settings] = useState(readSettings);
  const media = useMedia();
  const recorder = useRecorder();
  const video = useRef<HTMLVideoElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const captionsHandle = useRef<ReturnType<typeof startCaptions> | null>(null);
  const presence = usePresence(settings.cameraPresence, video);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [captions, setCaptions] = useState("");
  const [typing, setTyping] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const { phase, error, spoken } = state;
  const question = currentQuestion(state);
  const turn = currentTurn(state);
  const targetSec = difficultyOf(state.session.config.difficulty).targetSec;
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { start: startMedia, stream } = media;
  useEffect(() => {
    void startMedia();
  }, [startMedia]);

  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  useLevel(stream, (level) => {
    meter.current?.style.setProperty("--level", String(level));
    recorder.pushLevel(level);
  });

  useEffect(() => {
    if (phase !== "finished") void saveSession(state.session);
  }, [state.session, phase]);

  useEffect(() => {
    if (phase !== "asking") return;
    if (!settings.speakQuestions) {
      dispatch({ type: "spoken" });
      return;
    }
    let live = true;
    const speech = speak(spoken, { voiceURI: settings.voiceURI, rate: settings.speechRate });
    speech.finished.then(() => {
      if (live) dispatch({ type: "spoken" });
    });
    return () => {
      live = false;
      speech.cancel();
    };
  }, [phase, spoken, settings]);

  useEffect(() => {
    if (phase !== "thinking" || error) return;
    let live = true;
    nextTurn(buildTurnRequest(stateRef.current)).then(
      (reply) => live && dispatch({ type: "reply", reply }),
      (problem) => live && dispatch({ type: "fail", message: errorMessage(problem) }),
    );
    return () => {
      live = false;
    };
  }, [phase, error]);

  useEffect(() => {
    if (phase !== "finished") return;
    const id = state.session.id;
    void saveSession(state.session).then(() => router.replace(`/report/${id}`));
  }, [phase, state.session, router]);

  useEffect(() => {
    if (phase !== "answering") return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => {
      window.clearInterval(timer);
      setSeconds(0);
    };
  }, [phase]);

  const canRecord = media.status === "ready" && media.micOn;
  const isCode = question?.answerFormat === "code";

  const startRecording = useCallback(() => {
    if (!stream) return;
    setCaptions("");
    setNotice("");
    recorder.start(stream, settings.recordVideo);
    captionsHandle.current = startCaptions(setCaptions);
    presence.begin();
    setRecording(true);
  }, [stream, recorder, settings.recordVideo, presence]);

  const stopRecording = useCallback(async () => {
    setRecording(false);
    const live = captionsHandle.current?.stop() ?? "";
    captionsHandle.current = null;
    const facingRatio = presence.end();
    const result = await recorder.stop();
    if (!result) return;

    const current = stateRef.current;
    const turnId = currentTurn(current)?.id;
    if (settings.recordVideo && result.clip && turnId) {
      void saveClip(current.session.id, turnId, result.clip).catch(() => undefined);
    }

    setTranscribing(true);
    let text = live;
    try {
      text = (await transcribeAudio(result.audio)).text || live;
    } catch (problem) {
      setNotice(live ? "Transcription failed, so this is the live caption text. Check it before sending." : errorMessage(problem));
    }
    setTranscribing(false);

    dispatch({
      type: "answer_stopped",
      text,
      metrics: {
        ...buildMetrics({ text, seconds: result.seconds, mode: "voice", levels: result.levels, levelIntervalMs: LEVEL_INTERVAL_MS }),
        ...(facingRatio === undefined ? {} : { facingRatio }),
      },
    });
  }, [presence, recorder, settings.recordVideo]);

  const sendTyped = useCallback(() => {
    dispatch({ type: "answer_stopped", text: state.draft, metrics: buildMetrics({ text: state.draft, seconds, mode: "typed" }) });
    dispatch({ type: "submit" });
    setTyping(false);
  }, [state.draft, seconds]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || phase !== "answering" || typing || transcribing || !canRecord) return;
      const target = event.target as HTMLElement;
      if (target.closest("button, a, input, textarea, select, summary")) return;
      event.preventDefault();
      if (recording) void stopRecording();
      else startRecording();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, typing, transcribing, canRecord, recording, startRecording, stopRecording]);

  const heading = phase === "ready" ? "Find a quiet spot. The interviewer will speak first." : phase === "thinking" ? turn?.prompt : turn?.prompt ?? spoken;
  const mediaProblem = mediaMessage(media.status);
  const pastTarget = phase === "answering" && seconds > targetSec;

  return (
    <div className="room">
      <header className="room__bar">
        <div className="room__meta">
          <span className="wordmark">Hotseat</span>
          <span>{state.session.config.role}</span>
          <ol className="steps" aria-label={`Question ${state.questionIndex + 1} of ${state.session.plan.questions.length}`}>
            {state.session.plan.questions.map((q, i) => (
              <li key={q.id} data-state={i < state.questionIndex ? "done" : i === state.questionIndex ? "now" : "next"} />
            ))}
          </ol>
          <span>Question {state.questionIndex + 1} of {state.session.plan.questions.length}</span>
        </div>
        {confirmEnd ? (
          <div className="btn-row">
            <span>End and get your report?</span>
            <button type="button" className="btn" onClick={() => { void recorder.stop(); captionsHandle.current?.stop(); dispatch({ type: "end" }); }}>End interview</button>
            <button type="button" className="btn" onClick={() => setConfirmEnd(false)}>Keep going</button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmEnd(true)}>End early</button>
        )}
      </header>

      <main id="main" className="room__body">
        <div className="room__stage">
          <p className="room__state" role="status" data-testid="room-state">
            {recording ? "Recording your answer" : transcribing ? "Transcribing" : STATE_LABEL[phase]}
          </p>
          <p className="room__question" data-testid="question" aria-live="polite">{heading}</p>

          {phase === "answering" && canRecord && !typing && !recording && !transcribing && (
            <p className="field__help">Take a moment to think. Press Space or Start answer when you are ready.</p>
          )}
          {recording && <p className="field__help">Press Space or Stop answer when you finish.</p>}

          {state.hintShown && <p className="hint">{question.hint}</p>}

          {error && (
            <div className="notice" role="alert">
              <span>{error}</span>
              {phase === "thinking" && (
                <span className="btn-row">
                  <button type="button" className="btn" onClick={() => dispatch({ type: "retry" })}>Try again</button>
                  <button type="button" className="btn" onClick={() => dispatch({ type: "reply", reply: { acknowledgement: "", action: "next", followUp: "" } })}>Next question</button>
                </span>
              )}
            </div>
          )}
          {notice && <div className="notice" role="alert">{notice}</div>}

          {isCode && (phase === "answering" || phase === "reviewing") && (
            <div className="field">
              <label className="field__label" htmlFor="code">Your code</label>
              <textarea id="code" className="input input--code" spellCheck={false} maxLength={LIMITS.codeChars} value={state.draftCode} onChange={(event) => dispatch({ type: "edit_code", code: event.target.value })} />
            </div>
          )}

          {(typing || phase === "reviewing") && (
            <div className="field">
              <label className="field__label" htmlFor="answer">{phase === "reviewing" ? "Your answer, as transcribed. Fix anything it misheard." : "Your answer"}</label>
              <textarea id="answer" className="input" maxLength={LIMITS.answerChars} value={state.draft} onChange={(event) => dispatch({ type: "edit_draft", text: event.target.value })} />
            </div>
          )}
        </div>

        <aside className="room__side" aria-label="Your camera and microphone">
          <div className="selfview">
            <video ref={video} autoPlay muted playsInline aria-label="Your camera" hidden={!media.cameraOn || !stream?.getVideoTracks().length} />
            {(!media.cameraOn || !stream?.getVideoTracks().length) && <div className="selfview__off">Camera off</div>}
          </div>
          <div className="meter" ref={meter} aria-hidden="true"><div className="meter__fill" /></div>
          {mediaProblem && <div className="notice notice--info" role="status">{mediaProblem}</div>}
          {(recording || captions) && (
            <div className="room__captions" aria-live="off">
              {captions || "Live captions appear here where your browser supports them. Your transcript is still made when you stop."}
            </div>
          )}
        </aside>
      </main>

      <footer className="room__dock">
        <div className="btn-row">
          <button type="button" className={`btn${media.micOn ? " btn--on" : ""}`} aria-pressed={media.micOn} disabled={media.status !== "ready" || recording} onClick={media.toggleMic}>
            {media.micOn ? "Mic on" : "Mic off"}
          </button>
          <button type="button" className={`btn${media.cameraOn ? " btn--on" : ""}`} aria-pressed={media.cameraOn} disabled={media.status !== "ready" || !stream?.getVideoTracks().length || recording} onClick={media.toggleCamera}>
            {media.cameraOn ? "Camera on" : "Camera off"}
          </button>
          {phase === "answering" && (
            <span className="timer" data-past={pastTarget}>{clock(seconds)} of {clock(targetSec)}{pastTarget ? ", wrap up" : ""}</span>
          )}
        </div>

        <div className="btn-row">
          {phase === "ready" && <button type="button" className="btn btn--primary btn--large" onClick={() => dispatch({ type: "begin" })}>{state.session.turns.length ? "Resume interview" : "Begin interview"}</button>}

          {phase === "asking" && <button type="button" className="btn" onClick={() => dispatch({ type: "spoken" })}>Skip to answer</button>}

          {phase === "answering" && !recording && !transcribing && (
            <>
              {!state.hintShown && <button type="button" className="btn" onClick={() => dispatch({ type: "show_hint" })}>Show hint (costs 5 points)</button>}
              <button type="button" className="btn" onClick={() => dispatch({ type: "skip" })}>Skip</button>
              {typing ? (
                <button type="button" className="btn btn--primary btn--large" onClick={sendTyped}>Send answer</button>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => setTyping(true)}>Type instead</button>
                  {isCode && <button type="button" className="btn" onClick={sendTyped}>Send code only</button>}
                  <button type="button" className="btn btn--primary btn--large" disabled={!canRecord} onClick={startRecording}>Start answer</button>
                </>
              )}
            </>
          )}

          {recording && <button type="button" className="btn btn--primary btn--large" onClick={() => void stopRecording()}>Stop answer</button>}
          {transcribing && <button type="button" className="btn" aria-busy="true" disabled>Transcribing</button>}

          {phase === "reviewing" && (
            <>
              <button type="button" className="btn" onClick={() => { dispatch({ type: "start_answer" }); startRecording(); }} disabled={!canRecord}>Record again</button>
              <button type="button" className="btn btn--primary btn--large" onClick={() => dispatch({ type: "submit" })}>Send answer</button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
