"use client";

/**
 * Which way the board draws the pitch: a phone held upright gets the pitch
 * turned upright too, every other screen the pitch lying down.
 */
import { useSyncExternalStore } from "react";

import type { Orientation } from "./geometry";

const PORTRAIT_QUERY = "(max-width: 639px) and (orientation: portrait)";

function subscribeToPortrait(onChange: () => void): () => void {
  const query = window.matchMedia(PORTRAIT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useOrientation(): Orientation {
  const portrait = useSyncExternalStore(
    subscribeToPortrait,
    () => window.matchMedia(PORTRAIT_QUERY).matches,
    () => false,
  );
  return portrait ? "portrait" : "landscape";
}
