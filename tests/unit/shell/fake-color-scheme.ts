import { vi } from "vitest";

/**
 * A stand-in for `window.matchMedia("(prefers-color-scheme: light)")` that a
 * test can switch, firing `change` like the OS switching between light and
 * dark. jsdom has no `matchMedia` of its own.
 */
export function fakeColorScheme(initiallyLight: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: initiallyLight,
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return {
    setLight(light: boolean) {
      query.matches = light;
      listeners.forEach((listener) => listener());
    },
  };
}
