"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_THEME, nextTheme } from "./theme";
import {
  readActiveTheme,
  setThemePreference,
  subscribeTheme,
} from "./theme-store";

import { IconButton } from "@/components/forms/IconButton";
// Import the content module directly (not the feature barrel) so this client
// component does not pull in the barrel's server-only auth/db exports.
import { accessContent } from "@/features/access/content";

const { shell } = accessContent;

/**
 * The header's light/dark switch. It always flips the theme on screen and
 * pins the other one, so from `system` it leaves the OS behind; the settings
 * page's {@link ThemeChoice} is where the coach goes back to `system`. Its
 * server snapshot is {@link DEFAULT_THEME}, matching the SSR markup, so
 * hydration never mismatches, while the client snapshot reflects whatever
 * theme is actually live.
 */
export function ThemeToggle() {
  const current = useSyncExternalStore(
    subscribeTheme,
    readActiveTheme,
    () => DEFAULT_THEME,
  );

  const goingLight = current === "dark";

  return (
    <IconButton
      size="sm"
      name={goingLight ? "sun" : "moon"}
      label={goingLight ? shell.theme.toLight : shell.theme.toDark}
      active={current === "light"}
      onClick={() => setThemePreference(nextTheme(current))}
    />
  );
}
