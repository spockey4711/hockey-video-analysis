"use client";

import { createContext, useContext } from "react";

import type { Fullscreen } from "./use-fullscreen";

/**
 * Publishes the video stage's fullscreen state to the player's slot children,
 * the same way {@link PlayerControllerProvider} publishes playback. Sibling
 * lanes read it to adapt their chrome to the bare stage - the tag buttons, for
 * instance, show their capture confirmation on screen there, because the tags
 * rail that normally confirms a capture is not visible in fullscreen.
 *
 * Kept separate from {@link PlayerController} on purpose: that contract is about
 * the game timeline and is meant to stay small, while this is about the frame
 * the coach is looking at.
 */
const FullscreenContext = createContext<Fullscreen | null>(null);

export const FullscreenProvider = FullscreenContext.Provider;

/**
 * Read the video stage's fullscreen state. Returns an inactive, unsupported
 * state outside the player, so chrome that merely wants to adapt itself (rather
 * than drive fullscreen) can be rendered anywhere without a guard.
 */
export function useFullscreenState(): Fullscreen {
  return useContext(FullscreenContext) ?? INACTIVE;
}

const INACTIVE: Fullscreen = {
  isActive: false,
  isSupported: false,
  toggle: () => {},
  exit: () => {},
};
