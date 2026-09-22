/**
 * Thin, defensive wrappers around the browser Fullscreen API, shared by every
 * surface that offers a fullscreen upgrade: presentation mode on the share links
 * (P1-8) and the watch player's tagging fullscreen (P2-16). Both stay usable when
 * fullscreen is unavailable (older browsers, iOS Safari, jsdom in tests), so these
 * helpers only ever try to upgrade the experience and never throw if they cannot.
 * Kept free of React and of any feature import so the feature detection is
 * unit-testable without a real DOM.
 */

/** Whether `element` can request native fullscreen in this browser. */
export function isFullscreenSupported(element: Element | null): boolean {
  return typeof element?.requestFullscreen === "function";
}

/**
 * Whether some element currently owns the fullscreen viewport. Browsers without
 * the API leave `fullscreenElement` undefined rather than null, so this compares
 * loosely - otherwise "nothing is fullscreen" would read as "something is".
 */
export function isFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.fullscreenElement != null;
}

/** Whether `element` in particular is the one filling the screen right now. */
export function isFullscreenElement(element: Element | null): boolean {
  if (!element || typeof document === "undefined") return false;
  return document.fullscreenElement === element;
}

/**
 * Ask `element` to fill the screen. Resolves quietly on unsupported browsers or
 * if the request is rejected (e.g. not triggered by a user gesture), because the
 * calling surface is usable either way.
 */
export async function enterFullscreen(element: Element | null): Promise<void> {
  if (!element || typeof element.requestFullscreen !== "function") return;
  try {
    await element.requestFullscreen();
  } catch {
    // The caller still renders in place; native fullscreen is a bonus.
  }
}

/** Leave native fullscreen if we are in it; a no-op otherwise. */
export async function exitFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  if (!isFullscreenActive()) return;
  if (typeof document.exitFullscreen !== "function") return;
  try {
    await document.exitFullscreen();
  } catch {
    // Nothing actionable; state is reconciled by the fullscreenchange listener.
  }
}
