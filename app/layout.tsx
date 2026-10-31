import type { Metadata, Viewport } from "next";
import "./app.css";

export const metadata: Metadata = {
  title: "Hotseat, AI mock interviews",
  description: "A spoken mock interview built from your resume, with honest feedback.",
};

export const viewport: Viewport = {
  themeColor: "#0b0807",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
