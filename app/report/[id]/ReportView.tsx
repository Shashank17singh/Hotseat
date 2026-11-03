"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeatCurve } from "@/components/HeatCurve";
import { Notice } from "@/components/Notice";
import { createReport } from "@/lib/api-client";
import { DIFFICULTIES, INTERVIEW_TYPES, labelOf } from "@/lib/catalog";
import { paceNote, summarizeDelivery } from "@/lib/metrics";
import { heatStep } from "@/lib/score";
import { feedCourse, loadClip, loadSession, saveSession, writeSetupDraft } from "@/lib/storage";
import type { Report, Session, Turn } from "@/lib/types";

type Status = "loading" | "missing" | "empty" | "generating" | "error" | "ready";

function Clip({ sessionId, turnId }: { sessionId: string; turnId: string }) {
  const [clip, setClip] = useState<{ url: string; isVideo: boolean } | null>(null);

  useEffect(() => {
    let url = "";
    let live = true;
    loadClip(sessionId, turnId).then((blob) => {
      if (!blob || !live) return;
      url = URL.createObjectURL(blob);
      setClip({ url, isVideo: blob.type.startsWith("video") });
    }, () => undefined);
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [sessionId, turnId]);

  if (!clip) return null;
  return clip.isVideo
    ? <video controls playsInline preload="metadata" src={clip.url} aria-label="Your recorded answer" />
    : <audio controls preload="metadata" src={clip.url} aria-label="Your recorded answer" />;
}

function TurnBlock({ turn, sessionId }: { turn: Turn; sessionId: string }) {
  return (
    <div>
      {turn.kind === "follow_up" && <p className="review__label">Follow-up: {turn.prompt}</p>}
      <p className="review__label">Your answer</p>
      <p>{turn.skipped ? "Skipped." : turn.answer || "Code only."}</p>
      {turn.code && <pre className="code"><code>{turn.code}</code></pre>}
      <div style={{ marginTop: "var(--space-xs)" }}><Clip sessionId={sessionId} turnId={turn.id} /></div>
    </div>
  );
}

export function ReportView({ id }: { id: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<unknown>();

  const generate = useCallback(async (current: Session) => {
    setStatus("generating");
    setError(undefined);
    try {
      const report = await createReport({ config: current.config, questions: current.plan.questions, turns: current.turns });
      const scored: Session = { ...current, report, status: "complete", updatedAt: Date.now() };
      const finished: Session = { ...scored, reopened: await feedCourse(scored) };
      await saveSession(finished);
      setSession(finished);
      setStatus("ready");
    } catch (problem) {
      setError(problem);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadSession(id).then((found) => {
      if (!found) return setStatus("missing");
      setSession(found);
      if (found.report) return setStatus("ready");
      if (found.status === "in_progress") return router.replace(`/interview?id=${id}`);
      if (found.turns.length === 0) return setStatus("empty");
      void generate(found);
    }, () => setStatus("missing"));
  }, [id, generate, router]);

  if (status === "missing") {
    return (
      <div className="empty">
        <h2>This report was not found</h2>
        <p>Reports are stored in the browser that ran the interview.</p>
        <Link className="btn btn--primary" href="/history">See your history</Link>
      </div>
    );
  }
  if (status === "empty") {
    return (
      <div className="empty">
        <h2>No answers to review</h2>
        <p>This interview ended before any question was answered.</p>
        <Link className="btn btn--primary" href="/setup">Start a new interview</Link>
      </div>
    );
  }
  if (status === "error") return <Notice error={error} onRetry={() => session && void generate(session)} />;
  if (status === "loading" || status === "generating" || !session?.report) {
    return (
      <div role="status">
        <p className="page__sub" style={{ marginBottom: "var(--space-md)" }}>{status === "generating" ? "Reading your answers and writing your report. This takes up to a minute." : "Loading"}</p>
        <div className="skeleton" />
      </div>
    );
  }

  return <FullReport session={session} report={session.report} onPracticeAgain={() => {
    writeSetupDraft({ ...session.config, company: session.config.company ?? "", jobDescription: session.config.jobDescription ?? "", profile: session.profile });
    router.push("/setup");
  }} />;
}

function FullReport({ session, report, onPracticeAgain }: { session: Session; report: Report; onPracticeAgain: () => void }) {
  const { config, plan, turns } = session;
  const reached = report.questions.filter((q) => q.assessed);
  const points = reached.map((review) => {
    const index = plan.questions.findIndex((q) => q.id === review.id);
    return { label: `Q${index + 1}`, score: review.score, detail: plan.questions[index]?.competency };
  });
  const measured = turns.flatMap((t) => (t.metrics ? [t.metrics] : []));
  const delivery = summarizeDelivery(measured);
  const facing = measured.flatMap((m) => (m.facingRatio === undefined ? [] : [m.facingRatio]));
  const facingAverage = facing.length ? Math.round((facing.reduce((a, b) => a + b, 0) / facing.length) * 100) : null;

  // Collapsed questions would otherwise be left out of a printed report.
  useEffect(() => {
    const expand = () => document.querySelectorAll("details").forEach((item) => { item.open = true; });
    window.addEventListener("beforeprint", expand);
    return () => window.removeEventListener("beforeprint", expand);
  }, []);

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hotseat-${config.role.toLowerCase().replace(/\W+/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{config.role}</h1>
          <p className="page__sub">
            {labelOf(INTERVIEW_TYPES, config.type)}, {labelOf(DIFFICULTIES, config.difficulty)}, {new Date(session.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => window.print()}>Print or save PDF</button>
          <button type="button" className="btn" onClick={download}>Download data</button>
          <button type="button" className="btn btn--primary" onClick={onPracticeAgain}>Practise again</button>
        </div>
      </div>

      <section className="section">
        <div className="score">
          <span className="figure" data-testid="overall">{report.overall}</span>
          <span className="score__verdict">{report.verdict}</span>
        </div>
        <p style={{ marginTop: "var(--space-sm)" }}>{report.summary}</p>
        {reached.length < plan.questions.length && <p className="field__help" style={{ marginTop: "var(--space-xs)" }}>Scored on the {reached.length} of {plan.questions.length} questions you reached.</p>}
      </section>

      <section className="section" aria-labelledby="curve-head">
        <h2 id="curve-head">Score by question</h2>
        <p className="section__note">Each point is one question out of 100. Follow-ups count toward their question.</p>
        <HeatCurve points={points} caption={`Scores by question: ${points.map((p) => `${p.label} ${p.score}`).join(", ")}`} />
      </section>

      {(report.strengths.length > 0 || report.improvements.length > 0) && (
        <section className="section split">
          {report.strengths.length > 0 && (
            <div>
              <h2>What worked</h2>
              <ul className="list">{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {report.improvements.length > 0 && (
            <div>
              <h2>What to fix</h2>
              <ul className="list">{report.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {report.competencies.length > 0 && (
        <section className="section">
          <h2>Competencies</h2>
          <table className="rows">
            <thead><tr><th scope="col">Skill</th><th scope="col">Score</th><th scope="col" className="hide-narrow">Evidence</th></tr></thead>
            <tbody>
              {report.competencies.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td><span className="scorecell"><span className={`heat-key heat-${heatStep(item.score)}`} /><span className="figure">{Math.round(item.score)}</span></span></td>
                  <td className="hide-narrow">{item.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {delivery && (
        <section className="section" aria-labelledby="delivery-head">
          <h2 id="delivery-head">How you sounded</h2>
          <p className="section__note">Measured from your recordings, not judged by AI, and not part of your score.</p>
          <dl className="stats">
            <div><dt>Pace</dt><dd><span className="figure">{delivery.wordsPerMinute}</span> <small>words a minute. {paceNote(delivery.wordsPerMinute)}</small></dd></div>
            <div><dt>Filler words</dt><dd><span className="figure">{delivery.fillersPerMinute}</span> <small>a minute</small></dd></div>
            <div><dt>Longest pause</dt><dd><span className="figure">{delivery.longestPauseSec}</span> <small>seconds</small></dd></div>
            {facingAverage !== null && <div><dt>Facing the camera</dt><dd><span className="figure">{facingAverage}%</span> <small>of samples, an estimate from head position</small></dd></div>}
          </dl>
        </section>
      )}

      <section className="section" aria-labelledby="questions-head">
        <h2 id="questions-head" style={{ marginBottom: "var(--space-md)" }}>Question by question</h2>
        {plan.questions.map((question, index) => {
          const review = report.questions.find((q) => q.id === question.id);
          const exchange = turns.filter((t) => t.questionId === question.id);
          return (
            <details className="review" key={question.id} open={index === 0}>
              <summary>
                <span>{index + 1}. {question.question}</span>
                {review?.assessed ? (
                  <span className="scorecell"><span className={`heat-key heat-${heatStep(review.score)}`} /><span className="figure">{review.score}</span></span>
                ) : <span className="field__help">Not reached</span>}
              </summary>
              <div className="review__body">
                {exchange.map((turn) => <TurnBlock key={turn.id} turn={turn} sessionId={session.id} />)}
                {review?.whatWorked && <div><p className="review__label">What worked</p><p>{review.whatWorked}</p></div>}
                {review?.whatToImprove && <div><p className="review__label">What to improve</p><p>{review.whatToImprove}</p></div>}
                {review?.betterAnswer && <div><p className="review__label">A stronger answer</p><p>{review.betterAnswer}</p></div>}
              </div>
            </details>
          );
        })}
      </section>

      {session.courseId && (
        <section className="section" aria-labelledby="course-head">
          <h2 id="course-head">Back to your course</h2>
          {session.reopened?.length ? (
            <>
              <p className="section__note">These answers were weak, so the skills behind them are due for review again.</p>
              <ul className="list" data-testid="reopened">{session.reopened.map((name) => <li key={name}>{name}</li>)}</ul>
            </>
          ) : <p className="section__note">No skill needs reviewing after this interview.</p>}
          <div className="btn-row" style={{ marginTop: "var(--space-md)" }}>
            <Link className="btn" href={`/learn/${session.courseId}`}>Open your course</Link>
          </div>
        </section>
      )}

      {report.nextSteps.length > 0 && (
        <section className="section">
          <h2>This week</h2>
          <ul className="list">{report.nextSteps.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
    </>
  );
}
