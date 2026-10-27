import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "SCDI — Supply Chain Disruption Investigator",
  description:
    "Dark-mode operational dashboard for the Planner ↔ Executor ↔ Evaluator loop on Markovian chunks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${sora.variable} ${plexMono.variable} font-sans antialiased text-zinc-100`}
        style={{
          fontFamily: "var(--font-sora), system-ui, sans-serif",
        }}
      >
        <style>{`.font-mono{font-family:var(--font-plex-mono),ui-monospace,monospace}`}</style>
        {children}
      </body>
    </html>
  );
}
