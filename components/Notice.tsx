import Link from "next/link";
import { RequestError } from "@/lib/api-client";

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

export function Notice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const needsKey = error instanceof RequestError && error.code === "no_key";
  return (
    <div className="notice" role="alert">
      <span>{errorMessage(error)}</span>
      <span className="btn-row">
        {needsKey && <Link className="btn" href="/settings">Open Settings</Link>}
        {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
      </span>
    </div>
  );
}
