"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STATE_LABELS, VERDICT_LABELS, applyQuiz, claimAudit, courseStats, nextSkill, statesOf } from "@/lib/learn";
import { loadCourse, saveCourse } from "@/lib/storage";
import type { Course } from "@/lib/types";

type Answers = Record<string, number | "unsure" | undefined>;

export function CourseView({ id }: { id: string }) {
  const [course, setCourse] = useState<Course | null | undefined>();
  const [now, setNow] = useState(0);

  useEffect(() => {
    loadCourse(id).then((found) => {
      setNow(Date.now());
      setCourse(found ?? null);
    }, () => setCourse(null));
  }, [id]);

  async function place(answers: Answers) {
    if (!course) return;
    const time = Date.now();
    const placed = applyQuiz(course, answers, time);
    await saveCourse(placed);
    setNow(time);
    setCourse(placed);
    // The quiz is long, and the path's main action sits at the top of the page that replaces it.
    window.scrollTo(0, 0);
  }

  if (course === undefined) return <div className="skeleton" role="status" aria-label="Loading course" />;
  if (course === null) {
    return (
      <div className="empty">
        <h2>This course was not found</h2>
        <p>Courses are stored in the browser that built them.</p>
        <Link className="btn btn--primary" href="/learn">See your courses</Link>
      </div>
    );
  }
  if (!course.quizzedAt) return <Quiz course={course} onDone={(answers) => void place(answers)} />;
  return <CourseMap course={course} now={now} />;
}

function Quiz({ course, onDone }: { course: Course; onDone: (answers: Answers) => void }) {
  const [answers, setAnswers] = useState<Answers>({});
  const unanswered = course.skills.filter((skill) => answers[skill.id] === undefined).length;

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{course.title}</h1>
          <p className="page__sub">A quick check, so you are not taught what you already know. &quot;I don&apos;t know&quot; is a useful answer here.</p>
        </div>
      </div>
      <form className="quiz" onSubmit={(event) => { event.preventDefault(); onDone(answers); }}>
        {course.skills.map((skill, index) => (
          <fieldset className="choices" key={skill.id}>
            <legend>{index + 1}. {skill.quiz.question}</legend>
            {[...skill.quiz.options.map((option, value) => ({ option, value: value as number | "unsure" })), { option: "I don't know", value: "unsure" as const }].map(({ option, value }) => {
              const inputId = `${skill.id}-${value}`;
              return (
                <div className="choice" key={inputId}>
                  <input type="radio" name={skill.id} id={inputId} checked={answers[skill.id] === value} onChange={() => setAnswers((all) => ({ ...all, [skill.id]: value }))} />
                  <label htmlFor={inputId}><span className="choice__title">{option}</span></label>
                </div>
              );
            })}
          </fieldset>
        ))}
        <div className="summary-bar">
          <button type="button" className="textlink" onClick={() => onDone({})}>Skip this and start from the top</button>
          <button type="submit" className="btn btn--primary btn--large" disabled={unanswered > 0}>
            {unanswered > 0 ? `${unanswered} left to answer` : "See my path"}
          </button>
        </div>
      </form>
    </>
  );
}

function CourseMap({ course, now }: { course: Course; now: number }) {
  const stats = courseStats(course, now);
  const next = nextSkill(course, now);
  const audit = claimAudit(course);
  const nameOf = (id: string) => course.skills.find((skill) => skill.id === id)?.name;

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{course.title}</h1>
          <p className="page__sub" data-testid="course-stats">{stats.ready} of {stats.total} skills ready{stats.due > 0 ? `, ${stats.due} due for review` : ""}</p>
        </div>
        <div className="btn-row">
          {next && <Link className="btn btn--primary" href={`/learn/${course.id}/${next.id}`}>Continue: {next.name}</Link>}
          <Link className={next ? "btn" : "btn btn--primary"} href={`/setup?course=${course.id}`}>Test it in an interview</Link>
        </div>
      </div>

      <section className="section" aria-labelledby="path-head">
        <h2 id="path-head">Your path</h2>
        <p className="section__note">Foundations come first, and a skill counts as ready only once you have explained it yourself.</p>
        <ol className="path">
          {statesOf(course, now).map(({ skill, state }) => (
            <li key={skill.id} data-testid={`skill-${skill.id}`}>
              <Link href={`/learn/${course.id}/${skill.id}`}>{skill.name}</Link>
              <span className="state" data-state={state}>{STATE_LABELS[state]}</span>
              {skill.why && <span className="path__note">{skill.why}</span>}
              {skill.prerequisites.length > 0 && <span className="path__note">Builds on {skill.prerequisites.map(nameOf).join(", ")}</span>}
            </li>
          ))}
        </ol>
      </section>

      {audit.length > 0 && (
        <section className="section" aria-labelledby="audit-head">
          <h2 id="audit-head">Can you defend your resume?</h2>
          <p className="section__note">Each line an interviewer could press on, judged by what you have shown here so far.</p>
          <table className="rows">
            <thead><tr><th scope="col">Your resume says</th><th scope="col">So far</th></tr></thead>
            <tbody>
              {audit.map(({ skill, verdict }) => (
                <tr key={skill.id} data-testid={`claim-${skill.id}`}>
                  <td>{skill.claim}</td>
                  <td>{VERDICT_LABELS[verdict]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
