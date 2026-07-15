/**
 * Theme model for the coach app shell, kept as framework-free logic so the
 * toggle component and its tests share one source of truth.
 *
 * The active theme is expressed as a `data-theme` attribute on the document
 * root; the token layer (`src/styles/tokens/colors.css`) remaps its semantic
 * aliases off that attribute. The default is `dark` (the app is dark-first);
 * a coach's explicit choice is persisted in `localStorage` and, on a first
 * visit with no stored choice, we fall back to the OS `prefers-color-scheme`.
 */

export const THEMES = ["dark", "light"] as const;

export type Theme = (typeof THEMES)[number];

/** The app is dark-first; this is what SSR renders and the ultimate fallback. */
export const DEFAULT_THEME: Theme = "dark";

/** `localStorage` key holding the coach's explicit theme choice. */
export const THEME_STORAGE_KEY = "hva-theme";

/** Attribute the token layer keys its light overrides off (`<html data-theme>`). */
export const THEME_ATTRIBUTE = "data-theme";

/** Narrow an unknown (e.g. a `localStorage` read) to a valid {@link Theme}. */
export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
}

/** The other theme - the one a toggle would switch to. */
export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Resolve the theme to show before React hydrates, in priority order: an
 * explicit stored choice, then the OS preference, then {@link DEFAULT_THEME}.
 * Pure over its inputs so it can be unit-tested and reused by the inline
 * no-flash script.
 */
export function resolveTheme(
  stored: string | null,
  prefersLight: boolean,
): Theme {
  if (isTheme(stored)) return stored;
  return prefersLight ? "light" : DEFAULT_THEME;
}
