import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { completeJson, parseJson, spokenText, transcribe } from "@/lib/server/llm";

const schema = z.object({ answer: z.string() });
const call = (apiKey?: string) =>
  completeJson({ task: "turn", tier: "fast", system: "s", user: "u", schema, maxTokens: 10, apiKey });

function completion(content: string) {
  return new Response(
    JSON.stringify({ id: "1", object: "chat.completion", created: 1, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const failure = (status: number) => new Response(JSON.stringify({ error: { message: "no" } }), { status, headers: { "content-type": "application/json", "retry-after": "0" } });

const fetchMock = vi.fn<typeof fetch>();
const hosts = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)).hostname);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("LLM_PROVIDER", "");
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("parseJson", () => {
  it("reads JSON wrapped in a code fence", () => {
    expect(parseJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("throws when there is no object", () => {
    expect(() => parseJson("sorry")).toThrow();
  });
});

describe("completeJson", () => {
  it("passes temperature through only when one is set", async () => {
    vi.stubEnv("GROQ_API_KEY", "k");
    fetchMock.mockImplementation(async () => completion('{"answer":"ok"}'));
    await completeJson({ task: "plan", tier: "deep", system: "s", user: "u", schema, maxTokens: 10, temperature: 0.9 });
    await call();
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies[0].temperature).toBe(0.9);
    expect(bodies[1].temperature).toBeUndefined();
  });

  it("reports a missing key clearly", async () => {
    await expect(call()).rejects.toMatchObject({ code: "no_key", status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Groq with the visitor's key", async () => {
    fetchMock.mockImplementation(async () => completion('{"answer":"ok"}'));
    await expect(call("gsk_visitor")).resolves.toEqual({ answer: "ok" });
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer gsk_visitor");
    expect(hosts()).toEqual(["api.groq.com"]);
  });

  it("asks again when the reply does not match the schema", async () => {
    vi.stubEnv("GROQ_API_KEY", "k");
    fetchMock.mockResolvedValueOnce(completion('{"wrong":1}')).mockResolvedValueOnce(completion('{"answer":"fixed"}'));
    await expect(call()).resolves.toEqual({ answer: "fixed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up with an upstream error after a second bad reply", async () => {
    vi.stubEnv("GROQ_API_KEY", "k");
    fetchMock.mockImplementation(async () => completion("not json"));
    await expect(call()).rejects.toMatchObject({ code: "upstream" });
  });

  it("falls back to Gemini when Groq is rate limited", async () => {
    vi.stubEnv("GROQ_API_KEY", "k");
    vi.stubEnv("GEMINI_API_KEY", "g");
    fetchMock.mockImplementation(async (url) =>
      String(url).includes("groq") ? failure(429) : completion('{"answer":"from gemini"}'),
    );
    await expect(call()).resolves.toEqual({ answer: "from gemini" });
    expect(hosts().at(-1)).toBe("generativelanguage.googleapis.com");
  }, 20_000);

  it("does not spend the deployment's Gemini quota on a visitor's key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    fetchMock.mockImplementation(async () => failure(429));
    await expect(call("gsk_visitor")).rejects.toMatchObject({ code: "rate_limited", status: 429 });
    expect(new Set(hosts())).toEqual(new Set(["api.groq.com"]));
  }, 20_000);

  it("does not fall back on a bad key, and says so", async () => {
    vi.stubEnv("GROQ_API_KEY", "bad");
    vi.stubEnv("GEMINI_API_KEY", "g");
    fetchMock.mockImplementation(async () => failure(401));
    await expect(call()).rejects.toMatchObject({ code: "no_key" });
    expect(new Set(hosts())).toEqual(new Set(["api.groq.com"]));
  });

  it("never touches the network in mock mode", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    const result = await completeJson({
      task: "turn", tier: "fast", system: "s", user: "Main question: part 1", maxTokens: 10,
      schema: z.object({ action: z.string() }),
    });
    expect(result.action).toBe("follow_up");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("spokenText", () => {
  it("drops segments Whisper marks as probably not speech", () => {
    const segments = [
      { text: " I built the cache.", no_speech_prob: 0.02 },
      { text: " Thanks for watching!", no_speech_prob: 0.93 },
    ];
    expect(spokenText({ text: "I built the cache. Thanks for watching!", segments })).toBe("I built the cache.");
  });

  it("returns nothing for pure silence", () => {
    expect(spokenText({ text: "Thank you.", segments: [{ text: " Thank you.", no_speech_prob: 0.97 }] })).toBe("");
  });

  it("treats Whisper repeating its own prompt as silence", () => {
    const text = "Umm, let me think, uh, I mean, you know.";
    expect(spokenText({ text, segments: [{ text, no_speech_prob: 0.1 }] })).toBe("");
  });

  it.each(["Thank you.", "Thanks for watching!", "you", "Bye."])("treats Whisper's stock silence output %s as silence", (text) => {
    expect(spokenText({ text, segments: [{ text, no_speech_prob: 0.1 }] })).toBe("");
  });

  it("keeps an answer that merely contains those words", () => {
    const text = "Thank you. I rebuilt the importer.";
    expect(spokenText({ text, segments: [{ text, no_speech_prob: 0.1 }] })).toBe(text);
  });

  it("keeps real answers that contain fillers", () => {
    const text = "Um, I mean, I rebuilt the importer, you know.";
    expect(spokenText({ text, segments: [{ text, no_speech_prob: 0.05 }] })).toBe(text);
  });

  it("copes with a reply that has no segments", () => {
    expect(spokenText({ text: " hello " })).toBe("hello");
  });
});

describe("transcribe", () => {
  const audio = new File([new Uint8Array([1, 2, 3])], "answer.webm", { type: "audio/webm" });

  it("needs a Groq key because Gemini is not wired for speech", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    await expect(transcribe(audio)).rejects.toMatchObject({ code: "no_key" });
  });

  it("sends the audio to Groq Whisper and asks it to keep fillers", async () => {
    vi.stubEnv("GROQ_API_KEY", "k");
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ text: " hello " }), { headers: { "content-type": "application/json" } }));
    await expect(transcribe(audio)).resolves.toBe("hello");
    // The SDK probes FormData support with a data: URL before the real request.
    const sent = fetchMock.mock.calls.find(([url]) => String(url).includes("api.groq.com"));
    expect(String(sent?.[0])).toContain("/openai/v1/audio/transcriptions");
    const body = sent?.[1]?.body as FormData;
    expect(body.get("model")).toBe("whisper-large-v3-turbo");
    expect(body.get("response_format")).toBe("verbose_json");
    expect(String(body.get("prompt"))).toContain("Umm");
  });
});
