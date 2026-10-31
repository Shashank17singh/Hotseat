"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeatCurve } from "@/components/HeatCurve";
import { TopBar } from "@/components/TopBar";
import { DIFFICULTIES, difficultyOf, labelOf, INTERVIEW_TYPES } from "@/lib/catalog";
import { heatStep } from "@/lib/score";
import { deleteSession, listSessions } from "@/lib/storage";
import type { Session } from "@/lib/types";

const shortDate = (time: number) => new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    listSessions().then(setSessions, () => setFailed(true));
  }, []);

  async function remove(session: Session) {
    await deleteSession(session);
    setConfirming(null);
    setSessions((list) => list?.filter((s) => s.id !== session.id) ?? null);
  }

  const scored = (sessions ?? []).filter((s) => s.report).reverse();

  return (
    <>
      <TopBar />
      <main id="main" className="page">
        <div className="page__head">
          <div>
            <h1>History</h1>
            <p className="page__sub">Kept in this browser only.</p>
          </div>
        </div>

        {failed && <div className="notice" role="alert">Your history could not be opened. Private browsing can block local storage.</div>}
        {!failed && sessions === null && <div className="skeleton" role="status" aria-label="Loading history" />}
        {sessions?.length === 0 && (
          <div className="empty">
            <h2>No interviews yet</h2>
            <p>Finish one and its score and report will appear here.</p>
            <Link className="btn btn--primary" href="/setup">Start your first interview</Link>
          </div>
        )}

        {scored.length >= 2 && (
          <section className="section" aria-labelledby="trend-head">
            <h2 id="trend-head">Your scores over time</h2>
            <p className="section__note">The table below holds the same scores. Compare interviews at the same difficulty for a fair read.</p>
            <HeatCurve
              caption={`Overall scores over time: ${scored.map((s) => `${shortDate(s.createdAt)} ${s.report?.overall}`).join(", ")}`}
              points={scored.map((s) => ({ label: shortDate(s.createdAt), score: s.report?.overall ?? 0, detail: `${s.config.role}, ${labelOf(DIFFICULTIES, s.config.difficulty)}` }))}
            />
          </section>
        )}

        {sessions && sessions.length > 0 && (
          <table className="rows">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Role</th>
                <th scope="col" className="hide-narrow">Type</th>
                <th scope="col">Difficulty</th>
                <th scope="col">Score</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const href = session.status === "in_progress" ? `/interview?id=${session.id}` : `/report/${session.id}`;
                const difficulty = difficultyOf(session.config.difficulty);
                return (
                  <tr key={session.id}>
                    <td>{shortDate(session.createdAt)}</td>
                    <td><Link href={href}>{session.config.role}</Link></td>
                    <td className="hide-narrow">{labelOf(INTERVIEW_TYPES, session.config.type)}</td>
                    <td><span className="scorecell"><span className={`heat-key heat-${difficulty.heat}`} />{difficulty.label}</span></td>
                    <td>
                      {session.report ? (
                        <span className="scorecell"><span className={`heat-key heat-${heatStep(session.report.overall)}`} /><span className="figure">{session.report.overall}</span></span>
                      ) : session.status === "in_progress" ? "In progress" : "Report pending"}
                    </td>
                    <td>
                      {confirming === session.id ? (
                        <span className="btn-row">
                          <button type="button" className="btn btn--danger" onClick={() => void remove(session)}>Delete</button>
                          <button type="button" className="btn" onClick={() => setConfirming(null)}>Keep</button>
                        </span>
                      ) : (
                        <button type="button" className="textlink" onClick={() => setConfirming(session.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
