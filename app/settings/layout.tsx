import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings & Privacy",
  description: "Configure interview preferences, audio settings, and privacy options on Hotseat.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
