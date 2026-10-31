"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DIFFICULTIES, INTERVIEW_TYPES, PERSONAS, QUESTION_COUNTS, ROLE_GROUPS, SENIORITIES, difficultyOf, labelOf } from "@/lib/catalog";
import type { Difficulty, InterviewType, Persona, Seniority } from "@/lib/catalog";
import { createPlan, uploadResume } from "@/lib/api-client";
import { readSetupDraft, saveSession, writeSetupDraft } from "@/lib/storage";
import { LIMITS } from "@/lib/types";
import type { InterviewConfig, ResumeProfile, Session } from "@/lib/types";
import { Notice } from "@/components/Notice";
import { DeviceCheck } from "./DeviceCheck";

type Form = {
  role: string;
  seniority: Seniority;
  type: InterviewType;
  difficulty: Difficulty;
  persona: Persona;
  questionCount: number;
  company: string;
  jobDescription: string;
};

const DEFAULTS: Form = {
  role: "",
  seniority: "junior",
  type: "mixed",
  difficulty: "medium",
  persona: "neutral",
  questionCount: 5,
  company: "",
  jobDescription: "",
};

const ALL_ROLES: string[] = ROLE_GROUPS.flatMap((group) => [...group.roles]);

export function SetupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [profile, setProfile] = useState<ResumeProfile | undefined>();
  const [truncated, setTruncated] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<unknown>();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [over, setOver] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<unknown>();
  const [roleError, setRoleError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    const draft = readSetupDraft<Form & { profile?: ResumeProfile }>();
    const role = params.get("role");
    const difficulty = params.get("difficulty") as Difficulty | null;
    const { profile: savedProfile, ...fields } = draft;
    // Restoring a sessionStorage draft has to wait for the client, so it cannot be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((current) => ({
      ...current,
      ...fields,
      ...(role ? { role } : {}),
      ...(difficulty && DIFFICULTIES.some((d) => d.id === difficulty) ? { difficulty } : {}),
    }));
    setProfile(savedProfile);
    restored.current = true;
  }, [params]);

  useEffect(() => {
    if (restored.current) writeSetupDraft({ ...form, profile });
  }, [form, profile]);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function readResume(input: File | string) {
    setResumeBusy(true);
    setResumeError(undefined);
    try {
      const result = await uploadResume(input);
      setProfile(result.profile);
      setTruncated(result.truncated);
      setPasteOpen(false);
    } catch (error) {
      setResumeError(error);
    } finally {
      setResumeBusy(false);
    }
  }

  async function start() {
    if (form.role.trim().length < 2) {
      setRoleError(true);
      document.getElementById("role")?.focus();
      return;
    }
    setRoleError(false);
    setStarting(true);
    setStartError(undefined);
    const config: InterviewConfig = {
      role: form.role.trim(),
      seniority: form.seniority,
      type: form.type,
      difficulty: form.difficulty,
      persona: form.persona,
      questionCount: form.questionCount,
      company: form.company.trim() || undefined,
      jobDescription: form.jobDescription.trim() || undefined,
    };
    try {
      const plan = await createPlan(config, profile);
      const now = Date.now();
      const session: Session = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        config,
        profile,
        plan,
        turns: [],
        status: "in_progress",
      };
      await saveSession(session);
      router.push(`/interview?id=${session.id}`);
    } catch (error) {
      setStartError(error);
      setStarting(false);
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void start(); }} noValidate>
      <section className="section" aria-labelledby="resume-head">
        <h2 id="resume-head">Your resume</h2>
        <p className="section__note">Optional. With it, the interviewer asks about your actual projects. PDF, DOCX or TXT, up to 4 MB.</p>

        {profile ? (
          <div className="profile" data-testid="profile">
            <p className="profile__name">{profile.name || "Resume read"}</p>
            {profile.headline && <p>{profile.headline}</p>}
            {profile.skills.length > 0 && (
              <ul className="tags" aria-label="Skills found">
                {profile.skills.slice(0, 16).map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            )}
            {truncated && <p className="field__help">This resume was long, so only the first {LIMITS.resumeChars.toLocaleString()} characters were read.</p>}
            <p style={{ marginTop: "var(--space-sm)" }}>
              <button type="button" className="textlink" onClick={() => { setProfile(undefined); setTruncated(false); }}>Remove and use another</button>
            </p>
          </div>
        ) : (
          <div
            className="drop"
            data-over={over}
            onDragOver={(event) => { event.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              const file = event.dataTransfer.files[0];
              if (file) void readResume(file);
            }}
          >
            <p>Drop your resume here, or choose a file.</p>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="visually-hidden"
              aria-label="Resume file"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readResume(file);
                event.target.value = "";
              }}
            />
            <div className="btn-row">
              <button type="button" className="btn" aria-busy={resumeBusy} disabled={resumeBusy} onClick={() => fileInput.current?.click()}>
                {resumeBusy ? "Reading resume" : "Choose file"}
              </button>
              <button type="button" className="textlink" onClick={() => setPasteOpen((open) => !open)}>Paste text instead</button>
            </div>
            {pasteOpen && (
              <div className="field" style={{ width: "100%" }}>
                <label className="field__label" htmlFor="resume-text">Resume text</label>
                <textarea id="resume-text" className="input" value={pasted} maxLength={LIMITS.resumeChars} onChange={(event) => setPasted(event.target.value)} />
                <div><button type="button" className="btn" disabled={resumeBusy || !pasted.trim()} onClick={() => void readResume(pasted)}>Use this text</button></div>
              </div>
            )}
          </div>
        )}
        {resumeError !== undefined && <Notice error={resumeError} />}
      </section>

      <section className="section" aria-labelledby="role-head">
        <h2 id="role-head">The role</h2>
        <p className="section__note">Pick a role or type any job title.</p>
        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="role">Role you are applying for</label>
            <input
              id="role" className="input" list="role-list" autoComplete="off" required
              aria-invalid={roleError} aria-describedby={roleError ? "role-error" : undefined}
              value={form.role} onChange={(event) => update("role", event.target.value)} placeholder="Backend Engineer"
            />
            <datalist id="role-list">{ALL_ROLES.map((role) => <option key={role} value={role} />)}</datalist>
            {roleError && <p id="role-error" className="field__help" style={{ color: "var(--color-error)" }}>Enter the role so the questions fit it.</p>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="seniority">Level</label>
            <select id="seniority" className="input" value={form.seniority} onChange={(event) => update("seniority", event.target.value as Seniority)}>
              {SENIORITIES.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="company">Company (optional)</label>
          <input id="company" className="input" autoComplete="organization" value={form.company} onChange={(event) => update("company", event.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="jd">Job description (optional)</label>
          <textarea id="jd" className="input" maxLength={LIMITS.jobDescriptionChars} value={form.jobDescription} onChange={(event) => update("jobDescription", event.target.value)} placeholder="Paste the posting to target its requirements." />
        </div>
      </section>

      <section className="section" aria-labelledby="format-head">
        <h2 id="format-head">The format</h2>
        <p className="section__note">Difficulty sets the questions, how hard the follow-ups press and the time target.</p>
        <fieldset className="choices choices--row">
          <legend>Difficulty</legend>
          {DIFFICULTIES.map((level) => (
            <div className="choice" key={level.id}>
              <input type="radio" name="difficulty" id={`difficulty-${level.id}`} checked={form.difficulty === level.id} onChange={() => update("difficulty", level.id)} />
              <label htmlFor={`difficulty-${level.id}`}>
                <span className={`heat-key heat-${level.heat}`} />
                <span className="choice__title">{level.label}</span>
                <span className="choice__detail">{level.detail}</span>
              </label>
            </div>
          ))}
        </fieldset>
        <fieldset className="choices choices--three" style={{ marginTop: "var(--space-lg)" }}>
          <legend>Interview type</legend>
          {INTERVIEW_TYPES.map((type) => (
            <div className="choice" key={type.id}>
              <input type="radio" name="type" id={`type-${type.id}`} checked={form.type === type.id} onChange={() => update("type", type.id)} />
              <label htmlFor={`type-${type.id}`}>
                <span className="choice__title">{type.label}</span>
                <span className="choice__detail">{type.detail}</span>
              </label>
            </div>
          ))}
        </fieldset>
        <div className="grid-2" style={{ marginTop: "var(--space-lg)" }}>
          <fieldset className="choices choices--tight">
            <legend>Interviewer</legend>
            {PERSONAS.map((persona) => (
              <div className="choice" key={persona.id}>
                <input type="radio" name="persona" id={`persona-${persona.id}`} checked={form.persona === persona.id} onChange={() => update("persona", persona.id)} />
                <label htmlFor={`persona-${persona.id}`}><span className="choice__title">{persona.label}</span></label>
              </div>
            ))}
          </fieldset>
          <fieldset className="choices choices--tight">
            <legend>Questions</legend>
            {QUESTION_COUNTS.map((count) => (
              <div className="choice" key={count}>
                <input type="radio" name="count" id={`count-${count}`} checked={form.questionCount === count} onChange={() => update("questionCount", count)} />
                <label htmlFor={`count-${count}`}><span className="choice__title">{count}</span></label>
              </div>
            ))}
          </fieldset>
        </div>
      </section>

      <section className="section" aria-labelledby="device-head">
        <h2 id="device-head">Microphone and camera</h2>
        <p className="section__note">Check them now, or skip this and type your answers. Your video stays in this browser.</p>
        <DeviceCheck />
      </section>

      {startError !== undefined && <Notice error={startError} onRetry={() => void start()} />}

      <div className="summary-bar">
        <p>{form.role.trim() || "No role yet"}, {labelOf(DIFFICULTIES, form.difficulty)}, {form.questionCount} questions, about {Math.round((form.questionCount * difficultyOf(form.difficulty).targetSec) / 60 + form.questionCount)} minutes</p>
        <button type="submit" className="btn btn--primary btn--large" aria-busy={starting} disabled={starting}>
          {starting ? "Preparing questions" : "Start interview"}
        </button>
      </div>
    </form>
  );
}
