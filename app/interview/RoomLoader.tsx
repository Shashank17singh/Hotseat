"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loadSession } from "@/lib/storage";
import type { Session } from "@/lib/types";
import { Room } from "./Room";

export function RoomLoader() {
  const id = useSearchParams().get("id");
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    loadSession(id).then(
      (found) => setSession(found ?? null),
      () => setSession(null),
    );
  }, [id]);

  if (!id || session === null) {
    return (
      <main className="page page--narrow">
        <div className="empty">
          <h2>This interview was not found</h2>
          <p>Interviews are stored in the browser they started in.</p>
          <Link className="btn btn--primary" href="/setup">Start a new one</Link>
        </div>
      </main>
    );
  }
  if (!session) return <main className="page"><div className="skeleton" /></main>;
  return <Room session={session} />;
}
