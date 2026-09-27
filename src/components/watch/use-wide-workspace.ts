"use client";

/**
 * Whether the watch workspace shows its wide, three-column layout. Mirrors the
 * Tailwind `lg` breakpoint (64rem) that PlayerWorkspace switches its grid on, so
 * a component that must move content between the two layouts - not just restyle
 * it - reads the same answer as the CSS.
 */
import { useSyncExternalStore } from "react";

export const WIDE_WORKSPACE_QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(WIDE_WORKSPACE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isWide(): boolean {
  // Without media queries (a test DOM) assume the desktop layout.
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia(WIDE_WORKSPACE_QUERY).matches;
}

export function useWideWorkspace(): boolean {
  return useSyncExternalStore(subscribe, isWide, () => true);
}
