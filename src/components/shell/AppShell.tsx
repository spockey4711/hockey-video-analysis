import type { ReactNode } from "react";

import { AppHeader } from "./AppHeader";

import { getCurrentCoach } from "@/features/access";

/**
 * Top-level chrome shared by every coach page. The root layout wraps its
 * children in this shell: it reads the current session and, when a coach is
 * signed in, draws the {@link AppHeader} above the page. With no session (login,
 * signup and the login-free share surfaces) it renders children bare, so those
 * pages never leak the coach chrome. Pages keep running their own
 * `requireCoach()` guard - the missing bar is a presentation detail, not access
 * control.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const coach = await getCurrentCoach();

  return (
    <div className="flex min-h-screen flex-col">
      {coach && <AppHeader coachName={coach.name} />}
      {children}
    </div>
  );
}
