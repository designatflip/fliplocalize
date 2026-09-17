import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Localize — Flip",
  description: "Localization workspace for Flip UX Writing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
