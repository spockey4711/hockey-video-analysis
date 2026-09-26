import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell, ThemeScript } from "@/components/shell";
import { DEFAULT_THEME } from "@/components/shell/theme";
import { fontVariables } from "@/styles/fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Hockey Video Analysis",
  description:
    "Szenen in Feldhockey-Spielaufnahmen markieren und geschnittene Clips mit dem Team teilen.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="de"
      data-theme={DEFAULT_THEME}
      className={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[var(--bg-app)] font-sans text-[color:var(--text-primary)] antialiased">
        {/* Blocking, first-in-body: applies the coach's theme to <html> before
            any content paints, so there is no flash of the wrong theme. */}
        <ThemeScript />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
