import { isMock } from "./llm";

const BASE = "https://context7.com/api/v2";
// Most lookups take under two seconds, but a few take longer, so one slow call gets a second try.
const TIMEOUT_MS = 8000;
const ATTEMPTS = 2;
// Official and long-standing documentation scores 9 or more. Community notes on broad topics score lower.
const MIN_TRUST = 9;
const MAX_CHARS = 4000;
const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 200;
// Words a library title may carry that a learner's skill name will not, such as "Apache Kafka".
const TITLE_EXTRAS = new Set(["apache"]);

export type Docs = { title: string; text: string };

type Library = { id: string; title: string; state?: string; trustScore?: number };

// Per server instance, so repeat lessons on the same skill skip the network.
const cache = new Map<string, { docs: Docs | null; until: number }>();

const tokens = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);

async function get(path: string, params: Record<string, string>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) return response;
      lastError = new Error(`Docs lookup returned ${response.status}`);
      if (response.status < 500) break;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// A concept like "Multithreading" has no library of its own, and a loose match is dangerous: Multithreading.js
// once turned a C++ lesson into a JavaScript one. So every word of a library's title must appear in the skill.
function matching(libraries: Library[], subject: string) {
  const wanted = new Set(tokens(subject));
  return libraries.find(
    (library) =>
      library.state === "finalized" &&
      (library.trustScore ?? 0) >= MIN_TRUST &&
      tokens(library.title).every((word) => wanted.has(word) || TITLE_EXTRAS.has(word)),
  );
}

async function lookUp(skill: string, claim: string): Promise<Docs | null> {
  const search = await get("libs/search", { libraryName: claim || skill, query: skill });
  const { results } = (await search.json()) as { results?: Library[] };
  const library = matching(results ?? [], `${claim} ${skill}`);
  if (!library) return null;
  const context = await get("context", { libraryId: library.id, query: `${skill}: how it works and common mistakes`, type: "txt" });
  const text = (await context.text()).trim().slice(0, MAX_CHARS);
  return text ? { title: library.title, text } : null;
}

// Only the skill's name leaves the server here, never resume text. Docs make the review stronger but are
// not required, so any failure simply means the review runs without them, and is not cached.
export async function findDocs(skill: string, claim = "", now = Date.now()): Promise<Docs | null> {
  if (isMock()) return null;
  const key = `${claim}|${skill}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.until > now) return hit.docs;
  try {
    const docs = await lookUp(skill, claim);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    cache.set(key, { docs, until: now + CACHE_MS });
    return docs;
  } catch {
    return null;
  }
}

export function clearDocsCache() {
  cache.clear();
}
