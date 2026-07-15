import { DEFAULT_THEME, THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme";

/**
 * Blocking inline script that applies the coach's theme to `<html>` before the
 * first paint, so there is no flash of the wrong theme on load. It mirrors
 * {@link resolveTheme}'s priority (stored choice -> OS preference -> default)
 * but must stay self-contained plain JS - it runs first, before any module
 * loads. `RootLayout` renders it as the first child of `<body>`, so it executes
 * before any content paints. The `localStorage` key and target attribute are
 * injected from the shared constants so they cannot drift from the rest of the
 * shell.
 *
 * `RootLayout` renders `<html data-theme={DEFAULT_THEME} suppressHydrationWarning>`;
 * this script may rewrite that attribute before React hydrates, which is exactly
 * what `suppressHydrationWarning` is there to allow.
 */
export function ThemeScript() {
  const source = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":${JSON.stringify(
    DEFAULT_THEME,
  )};}document.documentElement.setAttribute(${JSON.stringify(
    THEME_ATTRIBUTE,
  )},t);}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
