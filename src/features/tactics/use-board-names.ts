import { useSyncExternalStore } from "react";

import { createDevicePreference } from "@/lib/device-preference";

/** `localStorage` key holding whether this device's board shows player names. */
export const BOARD_NAMES_STORAGE_KEY = "hva-board-names";

/**
 * Whether the coach's board shows the roster names under the discs, a
 * per-device choice like the presentation text size. Off when nothing is
 * stored. Only the coach's board and its picture read it; a login-free page
 * never has names to show.
 */
const boardNames = createDevicePreference({
  key: BOARD_NAMES_STORAGE_KEY,
  values: ["hidden", "shown"],
  fallback: "hidden",
});

/** The names choice, kept in step with another board or tab, and its setter. */
export function useBoardNames(): {
  readonly shown: boolean;
  readonly setShown: (shown: boolean) => void;
} {
  const value = useSyncExternalStore(
    boardNames.subscribe,
    boardNames.read,
    () => boardNames.fallback,
  );
  return {
    shown: value === "shown",
    setShown: (shown) => boardNames.write(shown ? "shown" : "hidden"),
  };
}
