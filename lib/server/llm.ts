import OpenAI, { APIConnectionError, APIError, toFile } from "openai";
import type { z } from "zod";
import { ApiError } from "./errors";
import { mockCompletion, mockTranscript } from "./mock";

export type Task = "profile" | "plan" | "turn" | "report";
type Tier = "fast" | "deep";

type Provider = { name: string; client: OpenAI; models: Record<Tier, string> };

const TIMEOUT_MS = 45_000;

function providers(visitorKey?: string): Provider[] {
  const list: Provider[] = [];
  const groqKey = visitorKey || process.env.GROQ_API_KEY;
  if (groqKey) {
    list.push({
      name: "groq",
      client: new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1", maxRetries: 1, timeout: TIMEOUT_MS }),
      models: {
        fast: process.env.GROQ_MODEL_FAST || "openai/gpt-oss-20b",
        deep: process.env.GROQ_MODEL_DEEP || "openai/gpt-oss-120b",
      },
    });
  }
  // Visitors who bring a key are never routed through the deployment's fallback quota.
  if (!visitorKey && process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    list.push({
      name: "gemini",
      client: new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        maxRetries: 1,
        timeout: TIMEOUT_MS,
      }),
      models: { fast: model, deep: model },
    });
  }
  return list;
}

export function isMock() {
  return process.env.LLM_PROVIDER === "mock";
}

export function hasServerKey() {
  return isMock() || Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);
}

export function parseJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("No JSON object in the reply");
  return JSON.parse(raw.slice(start, end + 1));
}

function isRetryableElsewhere(error: unknown) {
  if (error instanceof APIConnectionError) return true;
  return error instanceof APIError && (error.status === 429 || (error.status ?? 0) >= 500);
}

function toApiError(error: unknown): ApiError {
  if (error instanceof APIError && error.status === 429) {
    const retryAfter = Number(error.headers?.get("retry-after"));
    return new ApiError("rate_limited", "The AI service hit its rate limit.", Number.isFinite(retryAfter) ? retryAfter : 30);
  }
  if (error instanceof APIError && (error.status === 401 || error.status === 403)) {
    return new ApiError("no_key", "The AI service rejected the API key. Check it in Settings.");
  }
  return new ApiError("upstream", "The AI service did not respond. Try again.");
}

async function callModel(provider: Provider, tier: Tier, system: string, user: string, maxTokens: number, temperature?: number) {
  const response = await provider.client.chat.completions.create({
    model: provider.models[tier],
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: maxTokens,
    ...(temperature === undefined ? {} : { temperature }),
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function completeJson<S extends z.ZodType>(options: {
  task: Task;
  tier: Tier;
  system: string;
  user: string;
  schema: S;
  maxTokens: number;
  temperature?: number;
  apiKey?: string;
}): Promise<z.output<S>> {
  const { task, tier, system, user, schema, maxTokens, temperature, apiKey } = options;

  if (isMock()) {
    return schema.parse(mockCompletion(task, user));
  }

  const available = providers(apiKey);
  if (available.length === 0) {
    throw new ApiError("no_key", "No AI key is configured. Add a free Groq key in Settings.");
  }

  let lastError: unknown;
  for (const provider of available) {
    try {
      let prompt = user;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const raw = await callModel(provider, tier, system, prompt, maxTokens, temperature);
        try {
          return schema.parse(parseJson(raw));
        } catch (problem) {
          lastError = problem;
          prompt = `${user}\n\nYour previous reply was not valid. Return only one JSON object in the requested shape.`;
        }
      }
    } catch (error) {
      lastError = error;
      if (!isRetryableElsewhere(error)) throw toApiError(error);
    }
  }
  throw toApiError(lastError);
}

// Asking Whisper to keep disfluencies matters: without this prompt it tidies away the fillers we measure.
const VERBATIM_PROMPT = "Umm, let me think, uh, I mean, you know, so, hmm, kind of, sort of.";
const NO_SPEECH_LIMIT = 0.6;

const lettersOnly = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "");

// On silence Whisper tends to invent text, often by repeating its own prompt back.
export function spokenText(result: { text: string; segments?: { text: string; no_speech_prob: number }[] }) {
  const text = result.segments
    ? result.segments.filter((s) => s.no_speech_prob < NO_SPEECH_LIMIT).map((s) => s.text).join("").trim()
    : result.text.trim();
  return lettersOnly(VERBATIM_PROMPT).includes(lettersOnly(text)) ? "" : text;
}

export async function transcribe(audio: File, apiKey?: string) {
  if (isMock()) return mockTranscript();

  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    throw new ApiError("no_key", "Speech transcription needs a Groq key. Add one in Settings, or type your answer.");
  }
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1", maxRetries: 1, timeout: TIMEOUT_MS });
  try {
    const result = await client.audio.transcriptions.create({
      file: await toFile(audio, audio.name || "answer.webm", { type: audio.type }),
      model: process.env.GROQ_MODEL_STT || "whisper-large-v3-turbo",
      prompt: VERBATIM_PROMPT,
      language: "en",
      response_format: "verbose_json",
    });
    return spokenText(result);
  } catch (error) {
    throw toApiError(error);
  }
}
