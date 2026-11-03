"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/Notice";
import { ResumeInput } from "@/components/ResumeInput";
import { createOutline } from "@/lib/api-client";
import { ROLE_GROUPS, SENIORITIES } from "@/lib/catalog";
import type { Seniority } from "@/lib/catalog";
import { courseStats } from "@/lib/learn";
import { deleteCourse, listCourses, saveCourse } from "@/lib/storage";
import { LIMITS } from "@/lib/types";
import type { Course, CourseRequest, ResumeProfile } from "@/lib/types";

const ALL_ROLES: string[] = ROLE_GROUPS.flatMap((group) => [...group.roles]);

export function LearnHome() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [now, setNow] = useState(0);
  const [profile, setProfile] = useState<ResumeProfile | undefined>();
  const [topics, setTopics] = useState("");
  const [role, setRole] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("junior");
  const [jobDescription, setJobDescription] = useState("");
  const [missing, setMissing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<unknown>();
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    listCourses().then((found) => {
      setNow(Date.now());
      setCourses(found);
    }, () => undefined);
  }, []);

  async function build() {
    if (!profile && !topics.trim()) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setBuilding(true);
    setError(undefined);
    const request: CourseRequest = {
      seniority,
      profile,
      role: role.trim() || undefined,
      topics: topics.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
    };
    try {
      const outline = await createOutline(request);
      const time = Date.now();
      const course: Course = { ...outline, id: crypto.randomUUID(), createdAt: time, updatedAt: time, request, progress: {}, lessons: {} };
      await saveCourse(course);
      router.push(`/learn/${course.id}`);
    } catch (problem) {
      setError(problem);
      setBuilding(false);
    }
  }

  async function remove(id: string) {
    await deleteCourse(id);
    setConfirming(null);
    setCourses((list) => list.filter((course) => course.id !== id));
  }

  return (
    <>
      {courses.length > 0 && (
        <section className="section" aria-labelledby="courses-head">
          <h2 id="courses-head">Your courses</h2>
          <ul className="path">
            {courses.map((course) => {
              const stats = courseStats(course, now);
              return (
                <li key={course.id}>
                  <Link href={`/learn/${course.id}`}>{course.title}</Link>
                  {confirming === course.id ? (
                    <span className="btn-row">
                      <button type="button" className="btn btn--danger" onClick={() => void remove(course.id)}>Delete</button>
                      <button type="button" className="btn" onClick={() => setConfirming(null)}>Keep</button>
                    </span>
                  ) : (
                    <button type="button" className="textlink" onClick={() => setConfirming(course.id)}>Delete</button>
                  )}
                  <span className="path__note">{stats.ready} of {stats.total} ready{stats.due > 0 ? `, ${stats.due} due for review` : ""}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <form onSubmit={(event) => { event.preventDefault(); void build(); }} noValidate>
        <section className="section" aria-labelledby="source-head">
          <h2 id="source-head">What to learn</h2>
          <p className="section__note">Give a resume, topics, or both. With a resume, lessons use your own projects as examples.</p>
          <ResumeInput profile={profile} onChange={setProfile} />
          <div className="field" style={{ marginTop: "var(--space-md)" }}>
            <label className="field__label" htmlFor="topics">Topics</label>
            <textarea
              id="topics" className="input" maxLength={LIMITS.topicChars} value={topics}
              aria-invalid={missing} aria-describedby={missing ? "source-error" : undefined}
              onChange={(event) => setTopics(event.target.value)} placeholder="Database indexes, REST versus GraphQL, how caching fails"
            />
            {missing && <p id="source-error" className="field__help" style={{ color: "var(--color-error)" }}>Add a resume or at least one topic.</p>}
          </div>
        </section>

        <section className="section" aria-labelledby="target-head">
          <h2 id="target-head">What it is for</h2>
          <p className="section__note">Optional. These keep the course to what that interview would test.</p>
          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="learn-role">Target role</label>
              <input id="learn-role" className="input" list="learn-roles" autoComplete="off" value={role} onChange={(event) => setRole(event.target.value)} placeholder="Backend Engineer" />
              <datalist id="learn-roles">{ALL_ROLES.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="learn-level">Level</label>
              <select id="learn-level" className="input" value={seniority} onChange={(event) => setSeniority(event.target.value as Seniority)}>
                {SENIORITIES.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="learn-jd">Job description</label>
            <textarea id="learn-jd" className="input" maxLength={LIMITS.jobDescriptionChars} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the posting to add what your resume is missing." />
          </div>
        </section>

        {error !== undefined && <Notice error={error} onRetry={() => void build()} />}

        <div className="summary-bar">
          <p>Takes up to a minute to build.</p>
          <button type="submit" className="btn btn--primary btn--large" aria-busy={building} disabled={building}>
            {building ? "Building your course" : "Build my course"}
          </button>
        </div>
      </form>
    </>
  );
}
