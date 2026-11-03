import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { LearnHome } from "./LearnHome";

export const metadata: Metadata = { title: "Learn, Hotseat" };

export default function LearnPage() {
  return (
    <>
      <TopBar />
      <main id="main" className="page page--narrow">
        <div className="page__head">
          <div>
            <h1>Learn it first</h1>
            <p className="page__sub">A course built from your resume or topics, starting from the beginning. Kept in this browser only.</p>
          </div>
        </div>
        <LearnHome />
      </main>
    </>
  );
}
