/**
 * Pointer and keyboard rules shared by the stage's scrub bar and the editor's
 * trim handles: sliders over a stretch of the clip that a mouse, a finger or
 * the keyboard moves. Pure, so the rules are unit-tested without a DOM.
 */

/** Where `clientX` falls along a track, as a fraction from 0 to 1. */
export function fractionAt(
  clientX: number,
  track: { readonly left: number; readonly width: number },
): number {
  if (track.width <= 0) return 0;
  return Math.min(Math.max((clientX - track.left) / track.width, 0), 1);
}

/** How far the keys move a slider, in seconds. */
export interface SliderSteps {
  /** An arrow key. */
  readonly small: number;
  /** Shift with an arrow key, or Page Up / Page Down. */
  readonly large: number;
}

/**
 * The value a key press moves a slider at `value` to within `[min, max]`, or
 * null for a key the slider does not handle. Home and End jump to the ends.
 */
export function sliderKeyTarget(
  key: string,
  shiftKey: boolean,
  value: number,
  min: number,
  max: number,
  steps: SliderSteps,
): number | null {
  const step = shiftKey ? steps.large : steps.small;
  let target: number;
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      target = value - step;
      break;
    case "ArrowRight":
    case "ArrowUp":
      target = value + step;
      break;
    case "PageDown":
      target = value - steps.large;
      break;
    case "PageUp":
      target = value + steps.large;
      break;
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
  return Math.min(Math.max(target, min), max);
}

/**
 * A clip time as `M:SS,d`, to the nearest tenth of a second, the way the
 * stage's clock and the editor show it. Negative or non-finite input reads as
 * zero.
 */
export function formatClipTime(seconds: number): string {
  const tenths =
    Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 10) : 0;
  const minutes = Math.floor(tenths / 600);
  const secs = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(secs).padStart(2, "0")},${tenths % 10}`;
}
