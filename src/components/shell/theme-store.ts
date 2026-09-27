import {
  DEFAULT_THEME,
  isTheme,
  PREFERS_LIGHT_QUERY,
  THEME_ATTRIBUTE,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemePreference,
  resolveTheme,
} from "./theme";

import { createDevicePreference } from "@/lib/device-preference";

/**
 * The coach's theme preference on this device. `system` is the fallback, so
 * choosing it clears the stored key and the no-flash `ThemeScript` follows the
 * OS again on the next load.
 */
export const themePreference = createDevicePreference<ThemePreference>({
  key: THEME_STORAGE_KEY,
  values: THEME_PREFERENCES,
  fallback: "system",
});

function prefersLight(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(PREFERS_LIGHT_QUERY).matches
  );
}

/** Write the theme the current preference resolves to onto `<html>`. */
function applyTheme(): void {
  const preference = themePreference.read();
  const stored = preference === "system" ? null : preference;
  document.documentElement.setAttribute(
    THEME_ATTRIBUTE,
    resolveTheme(stored, prefersLight()),
  );
}

/**
 * The theme live on the page. The document root is its single source of
 * truth: the no-flash `ThemeScript` writes it before hydration and
 * {@link setThemePreference} rewrites it.
 */
export function readActiveTheme(): Theme {
  const attr = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isTheme(attr) ? attr : DEFAULT_THEME;
}

/** Store the coach's choice and show the theme it resolves to right away. */
export function setThemePreference(next: ThemePreference): void {
  themePreference.write(next);
  applyTheme();
}

/**
 * Listen for anything that can change the theme: a choice in this tab or
 * another, and the OS switching between light and dark while the preference
 * is `system`. The theme is re-applied before listeners run, so a snapshot
 * read in them is already current.
 */
export function subscribeTheme(onChange: () => void): () => void {
  const notify = () => {
    applyTheme();
    onChange();
  };
  const unsubscribe = themePreference.subscribe(notify);
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia(PREFERS_LIGHT_QUERY)
      : null;
  media?.addEventListener("change", notify);
  return () => {
    unsubscribe();
    media?.removeEventListener("change", notify);
  };
}
