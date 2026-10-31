"use client";

import { readSettings } from "./storage";
import type { ApiErrorBody, InterviewConfig, InterviewPlan, Report, ReportRequest, ResumeProfile, TurnReply, TurnRequest } from "./types";

export class RequestError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorBody["code"] | "offline",
    readonly retryAfterSec?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, body: BodyInit, json = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";
  const key = readSettings().groqKey.trim();
  if (key) headers["x-groq-key"] = key;

  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers, body });
  } catch {
    throw new RequestError("Could not reach the server. Check your connection and try again.", "offline");
  }
  if (response.ok) return response.json();

  const error: Partial<ApiErrorBody> = await response.json().catch(() => ({}));
  throw new RequestError(error.message ?? "The request failed. Try again.", error.code ?? "unknown", error.retryAfterSec);
}

export function uploadResume(input: File | string) {
  const form = new FormData();
  if (typeof input === "string") form.set("text", input);
  else form.set("file", input);
  return request<{ profile: ResumeProfile; truncated: boolean }>("/api/resume", form, false);
}

export const createPlan = (config: InterviewConfig, profile?: ResumeProfile) =>
  request<InterviewPlan>("/api/plan", JSON.stringify({ config, profile }));

export const nextTurn = (body: TurnRequest) => request<TurnReply>("/api/turn", JSON.stringify(body));

export const createReport = (body: ReportRequest) => request<Report>("/api/report", JSON.stringify(body));

export function transcribeAudio(blob: Blob) {
  const form = new FormData();
  form.set("audio", new File([blob], "answer.webm", { type: blob.type || "audio/webm" }));
  return request<{ text: string }>("/api/transcribe", form, false);
}
