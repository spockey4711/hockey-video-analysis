import { describe, expect, it } from "vitest";

import {
  activeMarker,
  markerFraction,
  nextMarker,
  previousMarker,
  sortMarkers,
  type JumpMarker,
} from "@/features/player/jump-markers/navigation";

// Four markers on the game timeline, deliberately out of order so the sort is
// exercised by every helper that consumes them.
const markers: JumpMarker[] = [
  { id: "c", type: "action_good", startS: 1200 },
  { id: "a", type: "goal", startS: 90 },
  { id: "d", type: "action_bad", startS: 1800 },
  { id: "b", type: "corner_short", startS: 600 },
];

describe("sortMarkers", () => {
  it("orders markers by start time without mutating the input", () => {
    const input = [...markers];
    expect(sortMarkers(input).map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
    expect(input.map((m) => m.id)).toEqual(["c", "a", "d", "b"]);
  });
});

describe("nextMarker", () => {
  it("returns the first marker strictly after the playhead", () => {
    expect(nextMarker(markers, 0)?.id).toBe("a");
    expect(nextMarker(markers, 100)?.id).toBe("b");
    expect(nextMarker(markers, 700)?.id).toBe("c");
  });

  it("skips a marker the playhead is parked on so repeated presses advance", () => {
    expect(nextMarker(markers, 600)?.id).toBe("c");
    expect(nextMarker(markers, 600.1)?.id).toBe("c");
  });

  it("returns null at or past the last marker", () => {
    expect(nextMarker(markers, 1800)).toBeNull();
    expect(nextMarker(markers, 5000)).toBeNull();
  });

  it("returns null for a non-finite playhead", () => {
    expect(nextMarker(markers, Number.NaN)).toBeNull();
  });
});

describe("previousMarker", () => {
  it("returns the last marker strictly before the playhead", () => {
    expect(previousMarker(markers, 5000)?.id).toBe("d");
    expect(previousMarker(markers, 700)?.id).toBe("b");
    expect(previousMarker(markers, 100)?.id).toBe("a");
  });

  it("skips a marker the playhead is parked on so repeated presses step back", () => {
    expect(previousMarker(markers, 600)?.id).toBe("a");
    expect(previousMarker(markers, 599.9)?.id).toBe("a");
  });

  it("returns null at or before the first marker", () => {
    expect(previousMarker(markers, 90)).toBeNull();
    expect(previousMarker(markers, 0)).toBeNull();
  });

  it("returns null for a non-finite playhead", () => {
    expect(previousMarker(markers, Number.NaN)).toBeNull();
  });
});

describe("activeMarker", () => {
  it("returns the marker under the playhead within the epsilon", () => {
    expect(activeMarker(markers, 90)?.id).toBe("a");
    expect(activeMarker(markers, 600.2)?.id).toBe("b");
  });

  it("returns null when the playhead is between markers", () => {
    expect(activeMarker(markers, 300)).toBeNull();
  });

  it("picks the nearest when two markers fall within the epsilon", () => {
    const close: JumpMarker[] = [
      { id: "x", type: "goal", startS: 100 },
      { id: "y", type: "goal", startS: 100.2 },
    ];
    expect(activeMarker(close, 100.05)?.id).toBe("x");
    expect(activeMarker(close, 100.15)?.id).toBe("y");
  });

  it("returns null for a non-finite playhead", () => {
    expect(activeMarker(markers, Number.NaN)).toBeNull();
  });
});

describe("markerFraction", () => {
  it("maps a start offset to its fraction of the game", () => {
    expect(markerFraction(900, 1800)).toBe(0.5);
    expect(markerFraction(0, 1800)).toBe(0);
  });

  it("clamps out-of-range offsets into [0, 1]", () => {
    expect(markerFraction(-100, 1800)).toBe(0);
    expect(markerFraction(3600, 1800)).toBe(1);
  });

  it("returns 0 when the total duration is unknown or non-positive", () => {
    expect(markerFraction(900, 0)).toBe(0);
    expect(markerFraction(900, -1)).toBe(0);
  });
});
