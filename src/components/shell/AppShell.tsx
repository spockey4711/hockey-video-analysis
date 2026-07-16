import type { ReactNode } from "react";

import { AppHeader } from "./AppHeader";
import { CoachHeader } from "./CoachHeader";

import { getCurrentCoach } from "@/features/access";

/**
 * Top-level chrome shared by every coach page. The root layout wraps its
 * children in this shell: it reads the current session and, when a coach is
 * signed in, draws the {@link AppHeader} above the page. With no session (login,
 * signup and the login-free share surfaces) it renders children bare, so those
 * pages never leak the coach chrome. The bar is built here (server-side, so its
 * session/db imports stay off the client) but wrapped in {@link CoachHeader},
 * which hides it per route from the live pathname: this shell sits in the root
 * layout, which Next.js does not re-render on client navigation, so the
 * per-route check has to live in a client boundary to stay correct as the coach
 * moves between surfaces. Pages keep running their own `requireCoach()` guard -
 * the missing bar is a presentation detail, not access control.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const coach = await getCurrentCoach();

  return (
    <div className="flex min-h-screen flex-col">
      {coach && (
        <CoachHeader>
          <AppHeader coachName={coach.name} />
        </CoachHeader>
      )}
      {children}
    </div>
  );
}
