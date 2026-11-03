import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { CourseView } from "./CourseView";

export const metadata: Metadata = { title: "Your course, Hotseat" };

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <TopBar />
      <main id="main" className="page page--narrow">
        <CourseView id={id} />
      </main>
    </>
  );
}
