import { describe, expect, it } from "vitest";

import { FULL_PICTURE } from "@/features/clip-edits";
import { zoomTransform } from "@/features/clip-edits/stage/picture-zoom";

describe("zoomTransform", () => {
  it("needs no transform for the whole picture", () => {
    expect(zoomTransform(FULL_PICTURE)).toBe("");
  });

  it("scales the crop up to the picture after moving its corner to the origin", () => {
    expect(zoomTransform({ x: 0.25, y: 0.5, w: 0.5 })).toBe(
      "scale(2) translate(-25%, -50%)",
    );
    expect(zoomTransform({ x: 0.1, y: 0, w: 0.3 })).toBe(
      "scale(3.333333) translate(-10%, 0%)",
    );
  });
});
