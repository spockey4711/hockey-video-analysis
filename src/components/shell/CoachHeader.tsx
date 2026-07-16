"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isImmersiveRoute } from "./immersive-routes";

/**
 * Client boundary that decides, per route, whether the coach header shows. It
 * must read the live {@link usePathname}: the {@link AppShell} lives in the root
 * layout, which Next.js does not re-render on client-side navigation, so a
 * server-side route check there freezes on the first-loaded path and leaves the
 * bar up when the coach clicks into an immersive surface (the watch/tagging
 * HUD). That stray bar sits above the HUD's own `100dvh` frame and pushes the
 * page into a permanent one-header-tall scroll. Reading the pathname here
 * re-evaluates on every navigation, so the bar drops on immersive routes and
 * returns everywhere else - correct on both the initial server render and
 * subsequent client navigations.
 *
 * The header itself is rendered by the server-side {@link AppShell} and handed in
 * as `children`, so this stays a thin gate and the header's server-only imports
 * (session, db) never cross into the client bundle.
 */
export function CoachHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isImmersiveRoute(pathname)) return null;
  return <>{children}</>;
}
