/**
 * Thin, defensive wrappers around the browser Fullscreen API for presentation
 * mode (P1-8). The overlay is a plain `fixed inset-0` layer, so it works even
 * when fullscreen is unavailable (older browsers, iOS Safari, jsdom in tests) -
 * these helpers only try to upgrade the experience and never throw if they
 * cannot. Kept out of the component so the feature detection is unit-testable
 * without a real DOM.
 */

/** Whether `element` can request native fullscreen in this browser. */
export function isFullscreenSupported(element: Element | null): boolean {
  return typeof element?.requestFullscreen === "function";
}

/** Whether some element currently owns the fullscreen viewport. */
export function isFullscreenActive(): boolean {
  return typeof document !== "undefined" && document.fullscreenElement !== null;
}

/**
 * Ask `element` to fill the screen. Resolves quietly on unsupported browsers or
 * if the request is rejected (e.g. not triggered by a user gesture), because the
 * overlay is usable either way.
 */
export async function enterFullscreen(element: Element | null): Promise<void> {
  if (!element || typeof element.requestFullscreen !== "function") return;
  try {
    await element.requestFullscreen();
  } catch {
    // The overlay still covers the viewport; native fullscreen is a bonus.
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
