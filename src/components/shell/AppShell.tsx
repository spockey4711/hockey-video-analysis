import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AppHeader } from "./AppHeader";
import { isImmersiveRoute, PATHNAME_HEADER } from "./immersive-routes";

import { getCurrentCoach } from "@/features/access";

/**
 * Top-level chrome shared by every coach page. The root layout wraps its
 * children in this shell: it reads the current session and, when a coach is
 * signed in, draws the {@link AppHeader} above the page. With no session (login,
 * signup and the login-free share surfaces) it renders children bare, so those
 * pages never leak the coach chrome. Immersive surfaces (the watch/tagging HUD)
 * carry their own full-viewport chrome, so the shared bar is dropped there too -
 * the current route comes from the middleware-set {@link PATHNAME_HEADER}, since
 * a server component cannot read the URL directly. Pages keep running their own
 * `requireCoach()` guard - the missing bar is a presentation detail, not access
 * control.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const [coach, headerList] = await Promise.all([getCurrentCoach(), headers()]);
  const pathname = headerList.get(PATHNAME_HEADER) ?? "";
  const showHeader = Boolean(coach) && !isImmersiveRoute(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      {showHeader && coach && <AppHeader coachName={coach.name} />}
      {children}
    </div>
  );
}
