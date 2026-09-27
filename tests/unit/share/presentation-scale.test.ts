import { afterEach, describe, expect, it } from "vitest";

import {
  nextPresentationScale,
  PRESENTATION_SCALE_STORAGE_KEY,
  presentationScale,
  presentationScaleFactor,
} from "@/features/share/presentation/presentation-scale";

afterEach(() => localStorage.clear());

describe("presentationScaleFactor", () => {
  it("grows the text by a quarter per step", () => {
    expect(presentationScaleFactor("normal")).toBe(1);
    expect(presentationScaleFactor("large")).toBe(1.25);
    expect(presentationScaleFactor("x-large")).toBe(1.5);
  });
});

describe("nextPresentationScale", () => {
  it("steps up and wraps back to normal", () => {
    expect(nextPresentationScale("normal")).toBe("large");
    expect(nextPresentationScale("large")).toBe("x-large");
    expect(nextPresentationScale("x-large")).toBe("normal");
  });
});

describe("presentationScale", () => {
  it("reads normal when nothing or something unknown is stored", () => {
    expect(presentationScale.read()).toBe("normal");
    localStorage.setItem(PRESENTATION_SCALE_STORAGE_KEY, "huge");
    expect(presentationScale.read()).toBe("normal");
  });

  it("reads a stored size back", () => {
    presentationScale.write("x-large");
    expect(localStorage.getItem(PRESENTATION_SCALE_STORAGE_KEY)).toBe(
      "x-large",
    );
    expect(presentationScale.read()).toBe("x-large");
  });
});
