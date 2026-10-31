import { ApiError } from "./errors";

const WINDOW_MS = 60 * 60 * 1000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Per-instance memory, so this slows casual abuse of the shared key rather than enforcing a hard quota.
export function checkRateLimit(ip: string, limit: number, now = Date.now()) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  const bucket = buckets.get(ip);
  if (!bucket) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (bucket.count >= limit) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    throw new ApiError("rate_limited", "You have reached the hourly practice limit on this site. Add your own free key in Settings to continue.", retryAfterSec);
  }
  bucket.count += 1;
}

export function resetRateLimits() {
  buckets.clear();
}
