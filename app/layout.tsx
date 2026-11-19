import type { Metadata, Viewport } from "next";
import "./app.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hotseat-black-chi.vercel.app"),
  title: {
    default: "Hotseat | AI Mock Interviews",
    template: "%s | Hotseat",
  },
  description: "A spoken mock interview platform that builds questions from your resume with audio analysis and honest feedback.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Hotseat | AI Mock Interviews",
    description: "A spoken mock interview platform that builds questions from your resume with audio analysis and honest feedback.",
    url: "https://hotseat-black-chi.vercel.app",
    siteName: "Hotseat",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
