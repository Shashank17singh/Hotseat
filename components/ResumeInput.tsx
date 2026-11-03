"use client";

import { useRef, useState } from "react";
import { uploadResume } from "@/lib/api-client";
import { LIMITS } from "@/lib/types";
import type { ResumeProfile } from "@/lib/types";
import { Notice } from "./Notice";

export function ResumeInput({ profile, onChange }: { profile?: ResumeProfile; onChange: (profile?: ResumeProfile) => void }) {
  const [truncated, setTruncated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function readResume(input: File | string) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await uploadResume(input);
      onChange(result.profile);
      setTruncated(result.truncated);
      setPasteOpen(false);
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
            <button type="button" className="textlink" onClick={() => { onChange(undefined); setTruncated(false); }}>Remove and use another</button>
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
            <button type="button" className="btn" aria-busy={busy} disabled={busy} onClick={() => fileInput.current?.click()}>
              {busy ? "Reading resume" : "Choose file"}
            </button>
            <button type="button" className="textlink" onClick={() => setPasteOpen((open) => !open)}>Paste text instead</button>
          </div>
          {pasteOpen && (
            <div className="field" style={{ width: "100%" }}>
              <label className="field__label" htmlFor="resume-text">Resume text</label>
              <textarea id="resume-text" className="input" value={pasted} maxLength={LIMITS.resumeChars} onChange={(event) => setPasted(event.target.value)} />
              <div><button type="button" className="btn" disabled={busy || !pasted.trim()} onClick={() => void readResume(pasted)}>Use this text</button></div>
            </div>
          )}
        </div>
      )}
      {error !== undefined && <Notice error={error} />}
    </>
  );
}
