import { describe, expect, it } from "vitest";

import {
  audienceWindowFeatures,
  otherScreen,
  type ScreenArea,
} from "@/features/share/presentation/audience-window";

const laptop: ScreenArea = {
  availLeft: 0,
  availTop: 25,
  availWidth: 1512,
  availHeight: 957,
};
const projector: ScreenArea = {
  availLeft: 1512,
  availTop: 0,
  availWidth: 1920,
  availHeight: 1080,
};

describe("audience window placement", () => {
  it("picks the screen the presenter is not on", () => {
    expect(
      otherScreen({ screens: [laptop, projector], currentScreen: laptop }),
    ).toBe(projector);
    expect(
      otherScreen({ screens: [laptop, projector], currentScreen: projector }),
    ).toBe(laptop);
    expect(
      otherScreen({ screens: [laptop], currentScreen: laptop }),
    ).toBeNull();
    expect(otherScreen(null)).toBeNull();
  });

  it("fills the other screen, or opens a plain window without one", () => {
    expect(audienceWindowFeatures(projector)).toBe(
      "popup,left=1512,top=0,width=1920,height=1080",
    );
    expect(audienceWindowFeatures(null)).toBe("popup,width=1280,height=720");
  });
});
