"use client";

import { clear, createStore, del, entries, get, set } from "idb-keyval";
import type { Session } from "./types";

const sessions = createStore("hotseat-sessions", "sessions");
const clips = createStore("hotseat-clips", "clips");

const SETUP_KEY = "hotseat.setup";
const SETTINGS_KEY = "hotseat.settings";

export type Settings = {
  groqKey: string;
  voiceURI: string;
  speechRate: number;
  speakQuestions: boolean;
  recordVideo: boolean;
  cameraPresence: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  groqKey: "",
  voiceURI: "",
  speechRate: 1,
  speakQuestions: true,
  recordVideo: true,
  cameraPresence: false,
};

export function readSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A blocked store only costs the visitor their preferences.
  }
}

export function readSetupDraft<T>(): Partial<T> {
  try {
    return JSON.parse(sessionStorage.getItem(SETUP_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function writeSetupDraft(value: unknown) {
  try {
    sessionStorage.setItem(SETUP_KEY, JSON.stringify(value));
  } catch {
    // Losing a form draft is harmless.
  }
}

export const saveSession = (session: Session) => set(session.id, session, sessions);
export const loadSession = (id: string) => get<Session>(id, sessions);

export async function listSessions() {
  const all = await entries<string, Session>(sessions);
  return all.map(([, session]) => session).sort((a, b) => b.createdAt - a.createdAt);
}

const clipKey = (sessionId: string, turnId: string) => `${sessionId}/${turnId}`;

export const saveClip = (sessionId: string, turnId: string, blob: Blob) =>
  set(clipKey(sessionId, turnId), blob, clips);

export const loadClip = (sessionId: string, turnId: string) =>
  get<Blob>(clipKey(sessionId, turnId), clips);

export async function deleteSession(session: Session) {
  await del(session.id, sessions);
  await Promise.all(session.turns.map((turn) => del(clipKey(session.id, turn.id), clips)));
}

export async function deleteEverything() {
  await Promise.all([clear(sessions), clear(clips)]);
}
