import { describe, expect, it } from "vitest";

import {
  addZoomKey,
  centreRectOn,
  clampRect,
  DEFAULT_ZOOM,
  isFullPicture,
  moveRect,
  moveZoomKey,
  oppositeCorner,
  rectFromCorners,
  removeZoomKey,
  scaleRect,
  setZoomEase,
  setZoomRect,
  withZoom,
} from "@/features/clip-editor/zoom";
import {
  EMPTY_EDIT,
  FULL_PICTURE,
  MAX_ZOOM_KEYS,
  MIN_ZOOM_WIDTH,
  parseClipEdit,
  type ZoomKey,
} from "@/features/clip-edits";

const window = { startS: 100, endS: 112 };
const keys: ZoomKey[] = [
  { atS: 102, rect: DEFAULT_ZOOM, ease: "glide" },
  { atS: 106, rect: FULL_PICTURE, ease: "hold" },
];

describe("crops", () => {
  it("keeps a crop inside the picture and no deeper than the limit", () => {
    expect(clampRect({ x: 0.9, y: -0.2, w: 0.5 })).toEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
    });
    expect(clampRect({ x: 0.5, y: 0.5, w: 0.05 }).w).toBe(MIN_ZOOM_WIDTH);
    expect(clampRect({ x: 0.2, y: 0.2, w: 2 })).toEqual(FULL_PICTURE);
    expect(clampRect({ x: 0.123456, y: 0.1, w: 0.333333 })).toEqual({
      x: 0.1235,
      y: 0.1,
      w: 0.3333,
    });
  });

  it("moves, centres and scales a crop within the picture", () => {
    expect(moveRect(DEFAULT_ZOOM, 0.1, -0.5)).toEqual({
      x: 0.35,
      y: 0,
      w: 0.5,
    });
    expect(centreRectOn(DEFAULT_ZOOM, { x: 0.9, y: 0.3 })).toEqual({
      x: 0.5,
      y: 0.05,
      w: 0.5,
    });
    expect(scaleRect(DEFAULT_ZOOM, 0.5)).toEqual({
      x: 0.375,
      y: 0.375,
      w: 0.25,
    });
    expect(scaleRect(DEFAULT_ZOOM, 4)).toEqual(FULL_PICTURE);
  });

  it("spans a crop from a held corner to the pointer, in the picture's shape", () => {
    expect(rectFromCorners({ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.4 })).toEqual({
      x: 0.2,
      y: 0.2,
      w: 0.4,
    });
    // Up and to the left of the corner.
    expect(rectFromCorners({ x: 0.8, y: 0.8 }, { x: 0.5, y: 0.6 })).toEqual({
      x: 0.5,
      y: 0.5,
      w: 0.3,
    });
    // No wider than the picture leaves room for.
    expect(rectFromCorners({ x: 0.7, y: 0.2 }, { x: 1, y: 1 })).toEqual({
      x: 0.7,
      y: 0.2,
      w: 0.3,
    });
    // A tiny span is the deepest zoom.
    expect(rectFromCorners({ x: 0.4, y: 0.4 }, { x: 0.41, y: 0.4 }).w).toBe(
      MIN_ZOOM_WIDTH,
    );
  });

  it("holds the corner opposite the one dragged", () => {
    expect(oppositeCorner(DEFAULT_ZOOM, { right: true, down: true })).toEqual({
      x: 0.25,
      y: 0.25,
    });
    expect(oppositeCorner(DEFAULT_ZOOM, { right: false, down: true })).toEqual({
      x: 0.75,
      y: 0.25,
    });
    expect(isFullPicture(FULL_PICTURE)).toBe(true);
    expect(isFullPicture(DEFAULT_ZOOM)).toBe(false);
  });
});

describe("keyframes", () => {
  it("adds a keyframe in play order, inside the window", () => {
    expect(addZoomKey(keys, 104.0004, DEFAULT_ZOOM, window)).toEqual({
      zoom: [keys[0], { atS: 104, rect: DEFAULT_ZOOM, ease: "glide" }, keys[1]],
      index: 1,
    });
    expect(addZoomKey([], 90, DEFAULT_ZOOM, window)?.zoom[0].atS).toBe(100);
  });

  it("picks the keyframe already at that moment instead of adding one", () => {
    expect(addZoomKey(keys, 106, DEFAULT_ZOOM, window)).toEqual({
      zoom: keys,
      index: 1,
    });
  });

  it("adds no keyframe past the cap", () => {
    const full = Array.from({ length: MAX_ZOOM_KEYS }, (_, index) => ({
      atS: 100 + index * 0.5,
      rect: FULL_PICTURE,
      ease: "hold" as const,
    }));
    expect(addZoomKey(full, 111.9, DEFAULT_ZOOM, window)).toBeNull();
  });

  it("moves a keyframe between its neighbours and inside the window", () => {
    expect(moveZoomKey(keys, 0, 103, window)[0].atS).toBe(103);
    expect(moveZoomKey(keys, 0, 108, window)[0].atS).toBe(105.999);
    expect(moveZoomKey(keys, 0, 90, window)[0].atS).toBe(100);
    expect(moveZoomKey(keys, 1, 101, window)[1].atS).toBe(102.001);
    expect(moveZoomKey(keys, 1, 120, window)[1].atS).toBe(112);
  });

  it("sets a keyframe's crop and ease, and removes one", () => {
    expect(setZoomRect(keys, 1, { x: 0.8, y: 0, w: 0.4 })[1].rect).toEqual({
      x: 0.6,
      y: 0,
      w: 0.4,
    });
    expect(setZoomEase(keys, 0, "hold")[0].ease).toBe("hold");
    expect(removeZoomKey(keys, 0)).toEqual([keys[1]]);
  });

  it("makes valid edits, and none once nothing is left", () => {
    expect(parseClipEdit(withZoom(null, keys)).ok).toBe(true);
    expect(withZoom({ ...EMPTY_EDIT, zoom: keys }, [])).toBeNull();
  });
});
