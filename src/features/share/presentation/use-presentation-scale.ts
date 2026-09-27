import { useSyncExternalStore } from "react";

import {
  type PresentationScale,
  presentationScale,
} from "./presentation-scale";

/**
 * This device's presentation text size, kept in step with a change in the
 * settings, the presentation toolbar or another tab. The server snapshot is
 * `normal`, the choice with nothing stored.
 */
export function usePresentationScale(): PresentationScale {
  return useSyncExternalStore(
    presentationScale.subscribe,
    presentationScale.read,
    () => presentationScale.fallback,
  );
}
