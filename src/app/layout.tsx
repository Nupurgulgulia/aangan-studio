import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aangan Studio Phone Desk" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions (e.g. Grammarly) inject attributes into <body>; don't flag that as a hydration error. */}
      <body suppressHydrationWarning>
        <main>
          <nav>
            <strong>Aangan Studio</strong>
            <a href="/dashboard">Pipeline</a>
            <a href="/dashboard/ops">Speed &amp; cost</a>
            <a href="/review">Front-desk review</a>
            <a href="/test-call">Test call</a>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
