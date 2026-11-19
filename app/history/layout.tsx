import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "History",
  description: "Review past mock interviews, scores, and feedback on Hotseat.",
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
