import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { ReportView } from "./ReportView";

export const metadata: Metadata = { title: "Your report, Hotseat" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <TopBar />
      <main id="main" className="page">
        <ReportView id={id} />
      </main>
    </>
  );
}
