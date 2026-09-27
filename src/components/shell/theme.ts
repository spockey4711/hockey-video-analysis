/**
 * Theme model for the coach app shell, kept as framework-free logic so the
 * theme store, its controls and their tests share one source of truth.
 *
 * The active theme is expressed as a `data-theme` attribute on the document
 * root; the token layer (`src/styles/tokens/colors.css`) remaps its semantic
 * aliases off that attribute. The coach's preference is one of three choices:
 * `light` or `dark` pin the design, `system` follows the OS
 * `prefers-color-scheme` and keeps following it as the OS switches. An explicit
 * choice is persisted in `localStorage`; `system` is the absence of one, so a
 * first visit follows the OS too. Where the OS gives no light preference the
 * app is dark-first.
 */

export const THEMES = ["dark", "light"] as const;

export type Theme = (typeof THEMES)[number];

/** What the coach picked: a fixed theme, or `system` to follow the OS. */
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** The app is dark-first; this is what SSR renders and the ultimate fallback. */
export const DEFAULT_THEME: Theme = "dark";

/** `localStorage` key holding the coach's explicit theme choice. */
export const THEME_STORAGE_KEY = "hva-theme";

/** Attribute the token layer keys its light overrides off (`<html data-theme>`). */
export const THEME_ATTRIBUTE = "data-theme";

/** The media query whose match means the OS asks for a light design. */
export const PREFERS_LIGHT_QUERY = "(prefers-color-scheme: light)";

/** Narrow an unknown (e.g. a `localStorage` read) to a valid {@link Theme}. */
export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
}

/** Narrow an unknown to a valid {@link ThemePreference}. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/** The other theme - the one a toggle would switch to. */
export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * The preference a stored value stands for: a stored fixed theme, and
 * `system` for anything else (nothing stored, or a value this build does not
 * know).
 */
export function preferenceFromStorage(stored: string | null): ThemePreference {
  return isTheme(stored) ? stored : "system";
}

/**
 * The theme to show, in priority order: an explicit stored choice, then the OS
 * preference, then {@link DEFAULT_THEME}. Pure over its inputs so it can be
 * unit-tested; the inline no-flash script mirrors it.
 */
export function resolveTheme(
  stored: string | null,
  prefersLight: boolean,
): Theme {
  const preference = preferenceFromStorage(stored);
  if (preference !== "system") return preference;
  return prefersLight ? "light" : DEFAULT_THEME;
}
