import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
  description: "The page you requested could not be found.",
};

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main id="main" className="page page--narrow" style={{ minHeight: "calc(100dvh - 120px)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <p className="figure" style={{ fontSize: "clamp(4rem, 12vw, 8rem)", lineHeight: 1, margin: "0 0 var(--space-md)", color: "var(--color-ink)" }}>
          404
        </p>
        <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-md)" }}>
          Page not found
        </h1>
        <p className="page__sub" style={{ maxWidth: "480px", margin: "0 auto var(--space-xl)", color: "var(--color-ink-2)" }}>
          This room doesn&apos;t exist or the interview session was moved. Return home to start practising.
        </p>
        <div className="btn-row" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", justifyContent: "center" }}>
          <Link href="/" className="btn btn--primary">
            Back to Home
          </Link>
          <Link href="/setup" className="btn">
            Start Practising
          </Link>
          <Link href="/learn" className="btn">
            Browse Topics
          </Link>
        </div>
      </main>
    </>
  );
}
