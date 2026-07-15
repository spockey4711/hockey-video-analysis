import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Hockey Video Analysis",
  description:
    "Tag moments in field-hockey game recordings and share cut clips with your team.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
