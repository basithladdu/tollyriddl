import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TollyRiddl — Can you name the film?",
  description: "A daily Tollywood film riddle.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
