"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { englishVoices, speak } from "@/lib/speech";
import { DEFAULT_SETTINGS, deleteEverything, readSettings, writeSettings } from "@/lib/storage";
import type { Settings } from "@/lib/storage";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [serverKey, setServerKey] = useState<boolean | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    // localStorage is only readable on the client, so this cannot be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(readSettings());
    fetch("/api/health").then((r) => r.json()).then((h) => setServerKey(h.serverKey), () => setServerKey(null));
    const load = () => setVoices(englishVoices());
    load();
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeSettings(next);
  }

  async function wipe() {
    await deleteEverything();
    setConfirmDelete(false);
    setDeleted(true);
  }

  return (
    <>
      <TopBar />
      <main id="main" className="page page--narrow">
        <div className="page__head"><h1>Settings</h1></div>

        <section className="section" aria-labelledby="key-head">
          <h2 id="key-head">AI access</h2>
          <p className="section__note">
            {serverKey === false
              ? "This site has no shared key, so you need your own to run an interview."
              : "This site has a shared key with an hourly limit. Your own key removes that limit."}{" "}
            Keys are free at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com</a>.
          </p>
          <div className="field">
            <label className="field__label" htmlFor="key">Groq API key</label>
            <input id="key" className="input" type="password" autoComplete="off" spellCheck={false} value={settings.groqKey} onChange={(event) => update({ groqKey: event.target.value })} />
            <p className="field__help">Saved in this browser. Sent with each request to reach Groq and never stored on the server.</p>
          </div>
        </section>

        <section className="section" aria-labelledby="voice-head">
          <h2 id="voice-head">Interviewer voice</h2>
          <p className="section__note">Voices come from your device, so the list differs between devices.</p>
          <div className="field">
            <label className="field__label" htmlFor="voice">Voice</label>
            <select id="voice" className="input" value={settings.voiceURI} onChange={(event) => update({ voiceURI: event.target.value })}>
              <option value="">Device default</option>
              {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="rate">Speed: {settings.speechRate.toFixed(1)}x</label>
            <input id="rate" type="range" min={0.7} max={1.4} step={0.1} value={settings.speechRate} onChange={(event) => update({ speechRate: Number(event.target.value) })} />
          </div>
          <div className="btn-row" style={{ marginTop: "var(--space-md)" }}>
            <button type="button" className="btn" onClick={() => speak("Tell me about a project you are proud of.", { voiceURI: settings.voiceURI, rate: settings.speechRate })}>Play a sample</button>
          </div>
        </section>

        <section className="section" aria-labelledby="room-head">
          <h2 id="room-head">In the room</h2>
          <Toggle id="speak" label="Read questions aloud" help="Turn off to read them on screen." checked={settings.speakQuestions} onChange={(speakQuestions) => update({ speakQuestions })} />
          <Toggle id="subtitles" label="Show subtitles" help="Shows what the interviewer is saying as it speaks." checked={settings.showSubtitles} onChange={(showSubtitles) => update({ showSubtitles })} />
          <Toggle id="clips" label="Keep recordings of my answers" help="Saved in this browser for replay in your report. Never uploaded." checked={settings.recordVideo} onChange={(recordVideo) => update({ recordVideo })} />
          <Toggle id="presence" label="Estimate how often I face the camera" help="Runs on this device and downloads a small model once. An estimate from head position, never part of your score." checked={settings.cameraPresence} onChange={(cameraPresence) => update({ cameraPresence })} />
        </section>

        <section className="section" aria-labelledby="data-head">
          <h2 id="data-head">Where your data goes</h2>
          <ul className="list">
            <li>Video stays in this browser and is never uploaded.</li>
            <li>Answer audio goes to Groq for transcription, and resume text and answers go to Groq to run the interview.</li>
            <li>In Chrome and Edge, live captions are processed by your browser&apos;s speech service.</li>
            <li>This site has no accounts or database, so reports exist only on this device.</li>
          </ul>
          <div className="btn-row" style={{ marginTop: "var(--space-md)" }}>
            {confirmDelete ? (
              <>
                <span>Delete every interview, report and recording?</span>
                <button type="button" className="btn btn--danger" onClick={() => void wipe()}>Delete everything</button>
                <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Keep them</button>
              </>
            ) : (
              <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>Delete all my data</button>
            )}
          </div>
          {deleted && <p className="field__help" role="status" style={{ marginTop: "var(--space-xs)" }}>All interviews and recordings were deleted.</p>}
        </section>
      </main>
    </>
  );
}

function Toggle({ id, label, help, checked, onChange }: { id: string; label: string; help: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="field" style={{ gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: "var(--space-sm)", alignItems: "start" }}>
      <input id={id} type="checkbox" style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--color-accent)" }} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id}>
        <span style={{ display: "block", fontWeight: 500 }}>{label}</span>
        <span className="field__help">{help}</span>
      </label>
    </div>
  );
}
