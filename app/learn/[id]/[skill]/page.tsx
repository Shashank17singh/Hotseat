import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { LessonView } from "./LessonView";

export const metadata: Metadata = { title: "Lesson, Hotseat" };

export default async function LessonPage({ params }: { params: Promise<{ id: string; skill: string }> }) {
  const { id, skill } = await params;
  return (
    <>
      <TopBar />
      <main id="main" className="page page--narrow">
        <LessonView courseId={id} skillId={skill} />
      </main>
    </>
  );
}
