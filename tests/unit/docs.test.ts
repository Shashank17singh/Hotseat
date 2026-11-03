import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDocsCache, findDocs } from "@/lib/server/docs";

const fetchMock = vi.fn<typeof fetch>();
const library = (title: string, patch = {}) => ({ id: "/x/y", title, state: "finalized", trustScore: 9, ...patch });
const found = (results: unknown[]) => new Response(JSON.stringify({ results }), { status: 200 });

beforeEach(() => {
  clearDocsCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("LLM_PROVIDER", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("findDocs", () => {
  it("returns the matching library's documentation, capped in size", async () => {
    fetchMock.mockResolvedValueOnce(found([library("FastAPI")])).mockResolvedValueOnce(new Response("x".repeat(9000)));
    const docs = await findDocs("FastAPI basics", "FastAPI");
    expect(docs?.title).toBe("FastAPI");
    expect(docs?.text).toHaveLength(4000);
  });

  it("sends only the skill name", async () => {
    fetchMock.mockResolvedValueOnce(found([]));
    await findDocs("Redis caching", "Redis");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("libraryName")).toBe("Redis");
    expect(url.searchParams.get("query")).toBe("Redis caching");
  });

  it("ignores a library that does not name the skill", async () => {
    fetchMock.mockResolvedValueOnce(found([library("Moment.js")]));
    expect(await findDocs("Multithreading concepts")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is not fooled by a library that only shares a word with a concept", async () => {
    fetchMock.mockResolvedValueOnce(found([library("Multithreading.js")]));
    expect(await findDocs("Multithreading concepts", "Multithreading")).toBeNull();
  });

  it("still finds a library with a two-word name", async () => {
    fetchMock.mockResolvedValueOnce(found([library("Node.js")])).mockResolvedValueOnce(new Response("docs"));
    expect((await findDocs("Node.js streams"))?.title).toBe("Node.js");
  });

  it("accepts an Apache prefix on a library title", async () => {
    fetchMock.mockResolvedValueOnce(found([library("Apache Kafka")])).mockResolvedValueOnce(new Response("docs"));
    expect((await findDocs("Kafka consumer groups", "Kafka"))?.title).toBe("Apache Kafka");
  });

  it("does not use community notes on a broad topic", async () => {
    fetchMock.mockResolvedValueOnce(found([library("System Design", { trustScore: 7.5 })]));
    expect(await findDocs("System design")).toBeNull();
  });

  it("retries one slow or failed call", async () => {
    fetchMock
      .mockRejectedValueOnce(new DOMException("slow", "TimeoutError"))
      .mockResolvedValueOnce(found([library("FastAPI")]))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("docs"));
    expect((await findDocs("FastAPI basics"))?.title).toBe("FastAPI");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry a request the service rejected", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad", { status: 400 }));
    expect(await findDocs("FastAPI basics")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("remembers a lookup for a day, but not a failure", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await findDocs("Redis caching", "Redis", 0)).toBeNull();
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(found([library("Redis")])).mockResolvedValueOnce(new Response("docs"));
    expect((await findDocs("Redis caching", "Redis", 0))?.title).toBe("Redis");
    expect((await findDocs("Redis caching", "Redis", 1000))?.title).toBe("Redis");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockResolvedValueOnce(found([]));
    expect(await findDocs("Redis caching", "Redis", 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("ignores low-trust and unfinished libraries", async () => {
    fetchMock.mockResolvedValueOnce(found([library("FastAPI", { trustScore: 2 }), library("FastAPI", { state: "processing" })]));
    expect(await findDocs("FastAPI basics")).toBeNull();
  });

  it("carries on without docs when the service fails", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await findDocs("FastAPI basics")).toBeNull();
    fetchMock.mockResolvedValue(new Response("no", { status: 500 }));
    expect(await findDocs("Docker images")).toBeNull();
  });

  it("never calls out in mock mode", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    expect(await findDocs("FastAPI basics")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
