"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Notice } from "@/components/Notice";
import { RequestError, checkExplanation, createLesson } from "@/lib/api-client";
import { COPY_LIMIT, PASS_SCORE, applyCheck, copiedShare, lessonText, nextSkill, progressOf } from "@/lib/learn";
import { loadCourse, saveCourse } from "@/lib/storage";
import { LIMITS } from "@/lib/types";
import type { CheckResult, Course, Lesson, Skill } from "@/lib/types";

// A search, because a link written by the model could point at a page that does not exist.
// Groq's free tier refills within a minute. Anything longer is the site's hourly limit, which waiting will not fix.
const MAX_WAIT_SEC = 90;
const pause = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const searchLink = (title: string) => `https://www.google.com/search?q=${encodeURIComponent(title)}`;

export function LessonView({ courseId, skillId }: { courseId: string; skillId: string }) {
  const [course, setCourse] = useState<Course | null | undefined>();
  const [error, setError] = useState<unknown>();
  const [waiting, setWaiting] = useState(0);
  const [rechecking, setRechecking] = useState(false);

  const teach = useCallback(async (current: Course, skill: Skill) => {
    setError(undefined);
    for (let attempt = 0; ; attempt += 1) {
      try {
        const lesson = await createLesson({
          skill: { id: skill.id, name: skill.name, claim: skill.claim, why: skill.why, prerequisites: skill.prerequisites },
          builtOn: skill.prerequisites.flatMap((id) => current.skills.find((s) => s.id === id)?.name ?? []),
          role: current.request.role,
          seniority: current.request.seniority,
          profile: current.request.profile,
        });
        const taught = { ...current, lessons: { ...current.lessons, [skill.id]: lesson } };
        await saveCourse(taught);
        setCourse(taught);
        return;
      } catch (problem) {
        const seconds = problem instanceof RequestError && problem.code === "rate_limited" ? problem.retryAfterSec ?? 30 : Infinity;
        if (attempt > 0 || seconds > MAX_WAIT_SEC) {
          setError(problem);
          return;
        }
        setWaiting(seconds);
        await pause(seconds);
        setWaiting(0);
      }
    }
  }, []);

  async function recheck(current: Course, skill: Skill) {
    setRechecking(true);
    await teach(current, skill);
    setRechecking(false);
  }

  useEffect(() => {
    loadCourse(courseId).then((found) => {
      setCourse(found ?? null);
      const skill = found?.skills.find((s) => s.id === skillId);
      if (found && skill && !found.lessons[skillId]) void teach(found, skill);
    }, () => setCourse(null));
  }, [courseId, skillId, teach]);

  const skill = course?.skills.find((s) => s.id === skillId);

  if (course === undefined) return <div className="skeleton" role="status" aria-label="Loading lesson" />;
  if (course === null || !skill) {
    return (
      <div className="empty">
        <h2>This lesson was not found</h2>
        <p>Courses are stored in the browser that built them.</p>
        <Link className="btn btn--primary" href="/learn">See your courses</Link>
      </div>
    );
  }

  const lesson = course.lessons[skillId];
  return (
    <>
      <div className="page__head">
        <div>
          <p className="page__sub"><Link href={`/learn/${course.id}`}>{course.title}</Link></p>
          <h1>{skill.name}</h1>
          {skill.claim && <p className="page__sub">Your resume says: {skill.claim}</p>}
        </div>
      </div>
      {error !== undefined && <Notice error={error} onRetry={() => void teach(course, skill)} />}
      {waiting > 0 && <div className="notice notice--info" role="status">The AI service is busy, so this will try again by itself in about {waiting} seconds.</div>}
      {!lesson && error === undefined && (
        <div role="status">
          <p className="page__sub" style={{ marginBottom: "var(--space-md)" }}>Writing this lesson around your background and fact-checking it. This takes up to a minute.</p>
          <div className="skeleton" />
        </div>
      )}
      {lesson && <LessonBody key={skillId} course={course} skill={skill} lesson={lesson} onCourse={setCourse} rechecking={rechecking} onRecheck={() => void recheck(course, skill)} />}
    </>
  );
}

type BodyProps = { course: Course; skill: Skill; lesson: Lesson; onCourse: (course: Course) => void; rechecking: boolean; onRecheck: () => void };

function factCheckNote(lesson: Lesson) {
  if (lesson.reviewed === false) return "The fact-check could not run for this lesson, so treat it with extra care.";
  if (lesson.checkedAgainst) return `Fact-checked by AI against the ${lesson.checkedAgainst} documentation, and it can still be wrong.`;
  return "Written and fact-checked by AI without official documentation to compare against, so it can still be wrong.";
}

function LessonBody({ course, skill, lesson, onCourse, rechecking, onRecheck }: BodyProps) {
  const [explanation, setExplanation] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>();
  const [result, setResult] = useState<CheckResult | undefined>();
  const [next, setNext] = useState<Skill | undefined>();
  const [copied, setCopied] = useState(false);
  const quizAnswer = progressOf(course, skill.id).quiz;

  async function check() {
    if (copiedShare(explanation, lessonText(lesson)) >= COPY_LIMIT) {
      setCopied(true);
      return;
    }
    setChecking(true);
    setError(undefined);
    try {
      const reply = await checkExplanation({ skill: skill.name, prompt: lesson.checkPrompt, keyPoints: lesson.keyPoints, explanation });
      const time = Date.now();
      const updated = applyCheck(course, skill.id, reply.score, time);
      await saveCourse(updated);
      onCourse(updated);
      setNext(nextSkill(updated, time));
      setResult(reply);
    } catch (problem) {
      setError(problem);
    } finally {
      setChecking(false);
    }
  }

  const passed = result !== undefined && result.score >= PASS_SCORE;

  return (
    <>
      {(quizAnswer === "wrong" || quizAnswer === "unsure") && (
        <section className="section lesson" aria-labelledby="quiz-head">
          <h2 id="quiz-head">From your quiz</h2>
          <p>{skill.quiz.question}</p>
          <p>The answer: {skill.quiz.options[skill.quiz.correct]}</p>
          {skill.quiz.explanation && <p>{skill.quiz.explanation}</p>}
        </section>
      )}

      {lesson.reviewed === false && (
        <div className="notice notice--info" data-testid="unchecked">
          <span>The fact-check could not run, so this lesson has not been checked.</span>
          <button type="button" className="btn" aria-busy={rechecking} disabled={rechecking} onClick={onRecheck}>{rechecking ? "Checking" : "Check it now"}</button>
        </div>
      )}

      <section className="section lesson" aria-labelledby="lesson-head">
        <h2 id="lesson-head">The idea</h2>
        <p className="page__sub">{lesson.summary}</p>
        {lesson.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {lesson.code && <pre className="code"><code>{lesson.code}</code></pre>}
      </section>

      {lesson.example && (
        <section className="section lesson" aria-labelledby="example-head">
          <h2 id="example-head">In your own work</h2>
          <p>{lesson.example}</p>
        </section>
      )}

      {(lesson.interviewQuestions.length > 0 || lesson.pitfalls.length > 0) && (
        <section className="section split">
          {lesson.interviewQuestions.length > 0 && (
            <div>
              <h2>What they will ask</h2>
              <ul className="list">{lesson.interviewQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {lesson.pitfalls.length > 0 && (
            <div>
              <h2>Where people slip</h2>
              <ul className="list">{lesson.pitfalls.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <section className="section" aria-labelledby="check-head">
        <h2 id="check-head">Now explain it back</h2>
        <p className="section__note">In your own words, without looking. You pass at {PASS_SCORE}, and this is what makes a skill ready.</p>
        <div className="field">
          <label className="field__label" htmlFor="explanation">{lesson.checkPrompt}</label>
          <textarea id="explanation" className="input" maxLength={LIMITS.answerChars} value={explanation} onChange={(event) => { setExplanation(event.target.value); setCopied(false); }} />
        </div>
        {copied && <div className="notice notice--info" role="status">This is mostly the lesson&apos;s own wording. Close it in your head and say it your way, so you know you can do it in the room.</div>}
        {error !== undefined && <Notice error={error} onRetry={() => void check()} />}
        {!passed && (
          <div className="btn-row" style={{ marginTop: "var(--space-sm)" }}>
            <button type="button" className="btn btn--primary" aria-busy={checking} disabled={checking || !explanation.trim()} onClick={() => void check()}>
              {checking ? "Reading your explanation" : result ? "Check again" : "Check my explanation"}
            </button>
          </div>
        )}

        {result && (
          <div className="result" role="status" data-testid="check-result">
            <p><span className="figure">{Math.round(result.score)}</span> {passed ? "You have got this one." : "Not there yet."}</p>
            {result.feedback && <p>{result.feedback}</p>}
            {result.missed.length > 0 && (
              <div>
                <p className="review__label">Still missing</p>
                <ul className="list">{result.missed.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
            {result.reteach && (
              <div>
                <p className="review__label">Another way to see it</p>
                <p>{result.reteach}</p>
              </div>
            )}
            {passed && (
              <div className="btn-row">
                {next
                  ? <Link className="btn btn--primary" href={`/learn/${course.id}/${next.id}`}>Next: {next.name}</Link>
                  : <Link className="btn btn--primary" href={`/setup?course=${course.id}`}>Test it in an interview</Link>}
                <Link className="btn" href={`/learn/${course.id}`}>Back to your path</Link>
              </div>
            )}
          </div>
        )}
      </section>

      {lesson.sources.length > 0 && (
        <section className="section" aria-labelledby="sources-head">
          <h2 id="sources-head">Check it yourself</h2>
          <p className="section__note">{factCheckNote(lesson)} These searches lead to the official material, which wins over anything here.</p>
          <ul className="list">{lesson.sources.map((title) => <li key={title}><a href={searchLink(title)} target="_blank" rel="noreferrer">{title}</a></li>)}</ul>
        </section>
      )}
    </>
  );
}
