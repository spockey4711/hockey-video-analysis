import { createDevicePreference } from "@/lib/device-preference";

/**
 * The text size of presentation mode, a per-device choice on top of the
 * screen-size scaling the presentation always does (`.type-presentation` in
 * `typography.css`): the team in the back row of a clubhouse, or a 4K TV
 * across the room, may need more than the screen width alone gives.
 */
export const PRESENTATION_SCALES = ["normal", "large", "x-large"] as const;

export type PresentationScale = (typeof PRESENTATION_SCALES)[number];

/** `localStorage` key holding this device's presentation text size. */
export const PRESENTATION_SCALE_STORAGE_KEY = "hva-presentation-scale";

/** How much each choice multiplies the presentation's type scale by. */
const FACTORS: Record<PresentationScale, number> = {
  normal: 1,
  large: 1.25,
  "x-large": 1.5,
};

/** The multiplier `--presentation-scale` carries for a choice. */
export function presentationScaleFactor(scale: PresentationScale): number {
  return FACTORS[scale];
}

/** The choice after `scale`, wrapping from the largest back to `normal`. */
export function nextPresentationScale(
  scale: PresentationScale,
): PresentationScale {
  const at = PRESENTATION_SCALES.indexOf(scale);
  return PRESENTATION_SCALES[(at + 1) % PRESENTATION_SCALES.length];
}

/** This device's presentation text size; `normal` when nothing is stored. */
export const presentationScale = createDevicePreference<PresentationScale>({
  key: PRESENTATION_SCALE_STORAGE_KEY,
  values: PRESENTATION_SCALES,
  fallback: "normal",
});
