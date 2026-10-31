import { Suspense } from "react";
import type { Metadata } from "next";
import { RoomLoader } from "./RoomLoader";

export const metadata: Metadata = { title: "Interview, Hotseat" };

export default function InterviewPage() {
  return (
    <Suspense fallback={<main className="page"><div className="skeleton" /></main>}>
      <RoomLoader />
    </Suspense>
  );
}
