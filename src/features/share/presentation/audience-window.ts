/**
 * Where the audience window opens (ADR 0015). With the Window Management API
 * and the viewer's permission (Chrome), the presenter knows the screens and
 * opens the window across the whole of another one, the projector; without,
 * it opens as a plain window the coach drags over. Pure, so the placement is
 * unit-tested without a browser.
 */

/** The part of a screen from the Window Management API this reads. */
export interface ScreenArea {
  readonly availLeft: number;
  readonly availTop: number;
  readonly availWidth: number;
  readonly availHeight: number;
}

/** The part of `ScreenDetails` this reads. */
export interface ScreensLike {
  readonly screens: readonly ScreenArea[];
  readonly currentScreen: ScreenArea;
}

/** The size of the window when no other screen is known. */
export const DEFAULT_AUDIENCE_SIZE = { width: 1280, height: 720 } as const;

/** A screen other than the one the presenter window is on, if there is one. */
export function otherScreen(details: ScreensLike | null): ScreenArea | null {
  if (!details) return null;
  return (
    details.screens.find((screen) => screen !== details.currentScreen) ?? null
  );
}

/**
 * The `window.open` features for the audience window: a popup filling
 * `screen`, or one of the default size where the browser puts it.
 */
export function audienceWindowFeatures(screen: ScreenArea | null): string {
  if (!screen) {
    const { width, height } = DEFAULT_AUDIENCE_SIZE;
    return `popup,width=${width},height=${height}`;
  }
  return [
    "popup",
    `left=${screen.availLeft}`,
    `top=${screen.availTop}`,
    `width=${screen.availWidth}`,
    `height=${screen.availHeight}`,
  ].join(",");
}

type ScreenDetailsWindow = Window & {
  getScreenDetails?: () => Promise<ScreensLike>;
};

/**
 * The screens, when the viewer already allowed this site to see them; `null`
 * otherwise, without asking. Safe to call on load.
 */
export async function grantedScreens(): Promise<ScreensLike | null> {
  const host = window as ScreenDetailsWindow;
  if (typeof host.getScreenDetails !== "function") return null;
  try {
    const status = await navigator.permissions.query({
      name: "window-management" as PermissionName,
    });
    if (status.state !== "granted") return null;
    return await host.getScreenDetails();
  } catch {
    return null;
  }
}

/**
 * The screens, asking the viewer for permission if the browser needs to;
 * `null` where the browser cannot tell or the viewer said no.
 */
export async function requestScreens(): Promise<ScreensLike | null> {
  const host = window as ScreenDetailsWindow;
  if (typeof host.getScreenDetails !== "function") return null;
  try {
    return await host.getScreenDetails();
  } catch {
    return null;
  }
}

/** Move an open window across the whole of `screen`, where the browser lets it. */
export function moveToScreen(target: Window, screen: ScreenArea): void {
  try {
    target.moveTo(screen.availLeft, screen.availTop);
    target.resizeTo(screen.availWidth, screen.availHeight);
  } catch {
    // The coach can still drag the window over.
  }
}
