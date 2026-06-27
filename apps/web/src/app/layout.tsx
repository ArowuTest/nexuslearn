import type { Metadata } from "next";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusLearn - Learning worlds for Years 1-7",
  description:
    "An adaptive learning adventure for UK Years 1-7. Curriculum-mapped missions, animated worlds, and clear progress for parents and schools.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className="font-body bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
