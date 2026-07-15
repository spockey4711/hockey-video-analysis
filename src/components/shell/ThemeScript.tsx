import { DEFAULT_THEME, THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme";

/**
 * The blocking inline script, as a constant literal. It reads its configuration
 * (storage key, target attribute, default theme) from `data-*` attributes on
 * its own `<script>` element via `document.currentScript`, so no runtime value
 * is ever interpolated into executable code - the source string is fixed and
 * carries nothing to sanitize. The shared constants still reach it (below), but
 * as HTML attribute data rather than code, so they cannot drift from the rest
 * of the shell.
 */
const THEME_SCRIPT =
  "(function(){try{var d=document.currentScript.dataset;" +
  "var t=localStorage.getItem(d.key);" +
  'if(t!=="dark"&&t!=="light"){' +
  't=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":d.default;}' +
  "document.documentElement.setAttribute(d.attr,t);}catch(e){}})();";

/**
 * Blocking inline script that applies the coach's theme to `<html>` before the
 * first paint, so there is no flash of the wrong theme on load. It mirrors
 * {@link resolveTheme}'s priority (stored choice -> OS preference -> default)
 * but must stay self-contained plain JS - it runs first, before any module
 * loads. `RootLayout` renders it as the first child of `<body>`, so it executes
 * before any content paints.
 *
 * `RootLayout` renders `<html data-theme={DEFAULT_THEME} suppressHydrationWarning>`;
 * this script may rewrite that attribute before React hydrates, which is exactly
 * what `suppressHydrationWarning` is there to allow.
 */
export function ThemeScript() {
  return (
    <script
      data-key={THEME_STORAGE_KEY}
      data-attr={THEME_ATTRIBUTE}
      data-default={DEFAULT_THEME}
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
