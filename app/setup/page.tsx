import { Suspense } from "react";
import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "New interview, Hotseat" };

export default function SetupPage() {
  return (
    <>
      <TopBar />
      <main id="main" className="page page--narrow">
        <div className="page__head">
          <div>
            <h1>Set up your interview</h1>
            <p className="page__sub">Only the role is required. Everything else sharpens the questions.</p>
          </div>
        </div>
        <Suspense fallback={<div className="skeleton" />}>
          <SetupForm />
        </Suspense>
      </main>
    </>
  );
}
