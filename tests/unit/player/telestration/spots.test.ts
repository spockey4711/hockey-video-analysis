import { describe, expect, it } from "vitest";

import {
  DEFAULT_SPOT_RADIUS,
  isSpotTool,
  MAX_SPOT_RADIUS,
  MIN_SPOT_RADIUS,
  movedSpot,
  resizedSpot,
  sizedSpot,
  spotExtent,
  spotPixels,
} from "@/features/player/telestration/spots";
import {
  DRAW_TOOLS,
  initialTelestrationState,
  MARK_TOOLS,
  MIN_SHAPE_EXTENT,
  telestrationReducer,
  type DrawTool,
  type Stroke,
  type TelestrationAction,
  type TelestrationState,
} from "@/features/player/telestration/state";

const at = (x: number, y: number) => ({ x, y });

function spot(
  tool: DrawTool,
  centre = at(0.5, 0.5),
  rim = at(0.6, 0.5),
): Stroke {
  return {
    tool,
    color: "yellow",
    width: "medium",
    style: "solid",
    points: [centre, rim],
  };
}

function run(
  actions: readonly TelestrationAction[],
  from: TelestrationState = initialTelestrationState,
): TelestrationState {
  return actions.reduce(telestrationReducer, from);
}

const open: TelestrationAction = { type: "open" };

describe("spot tools", () => {
  it("are offered on clip markers only, after the drawing tools", () => {
    expect(DRAW_TOOLS.some(isSpotTool)).toBe(false);
    expect(MARK_TOOLS).toEqual([...DRAW_TOOLS, "spotlight", "magnifier"]);
  });

  it("keep a dragged-out spot at the size of the drag", () => {
    const dragged = spot("spotlight", at(0.4, 0.6), at(0.45, 0.62));
    expect(sizedSpot(dragged, MIN_SHAPE_EXTENT)).toBe(dragged);
  });

  it.each(["spotlight", "magnifier"] as const)(
    "gives a tapped %s the tool's default size around the tap",
    (tool) => {
      const tapped = spot(tool, at(0.4, 0.6), at(0.4, 0.6));
      const sized = sizedSpot(tapped, MIN_SHAPE_EXTENT);
      expect(sized.points[0]).toEqual(at(0.4, 0.6));
      expect(spotExtent(sized)).toBeCloseTo(DEFAULT_SPOT_RADIUS[tool]);
    },
  );

  it("puts the rim on the other side at the picture's edge, keeping the size", () => {
    const tapped = spot("magnifier", at(0.98, 0.5), at(0.98, 0.5));
    const sized = sizedSpot(tapped, MIN_SHAPE_EXTENT);
    expect(sized.points[1]?.x).toBeCloseTo(
      0.98 - DEFAULT_SPOT_RADIUS.magnifier,
    );
    expect(spotExtent(sized)).toBeCloseTo(DEFAULT_SPOT_RADIUS.magnifier);
  });

  it("moves a spot with its rim and keeps its centre on the picture", () => {
    const moved = movedSpot(spot("spotlight"), 0.1, -0.2);
    expect(moved.points[0]?.x).toBeCloseTo(0.6);
    expect(moved.points[0]?.y).toBeCloseTo(0.3);
    expect(spotExtent(moved)).toBeCloseTo(0.1);

    const pushed = movedSpot(spot("spotlight"), 0.9, 0);
    expect(pushed.points[0]).toEqual(at(1, 0.5));
    expect(spotExtent(pushed)).toBeCloseTo(0.1);
  });

  it("resizes a spot around its centre, within bounds", () => {
    const grown = resizedSpot(spot("magnifier"), 2);
    expect(grown.points[0]).toEqual(at(0.5, 0.5));
    expect(spotExtent(grown)).toBeCloseTo(0.2);
    expect(spotExtent(resizedSpot(spot("magnifier"), 100))).toBeCloseTo(
      MAX_SPOT_RADIUS,
    );
    expect(spotExtent(resizedSpot(spot("magnifier"), 0.001))).toBeCloseTo(
      MIN_SPOT_RADIUS,
    );
  });

  it("measures the radius on screen, so a lens stays round on a wide picture", () => {
    const picture = { x: 10, y: 20, width: 1280, height: 720 };
    const pixels = spotPixels(
      spot("magnifier", at(0.5, 0.5), at(0.5, 0.6)),
      picture,
    );
    expect(pixels?.x).toBe(650);
    expect(pixels?.y).toBe(380);
    expect(pixels?.radius).toBeCloseTo(72);
  });
});

describe("telestrationReducer with spot tools", () => {
  const withTool = (tool: DrawTool): TelestrationAction => ({
    type: "setTool",
    tool,
  });

  it("keeps a tapped spot at its default size instead of dropping it", () => {
    const state = run([
      open,
      withTool("spotlight"),
      { type: "begin", point: at(0.3, 0.7) },
      { type: "end" },
    ]);
    expect(state.strokes).toHaveLength(1);
    expect(state.strokes[0]?.tool).toBe("spotlight");
    expect(spotExtent(state.strokes[0]!)).toBeCloseTo(
      DEFAULT_SPOT_RADIUS.spotlight,
    );
  });

  it("keeps a dragged spot as its centre and the rim point", () => {
    const state = run([
      open,
      withTool("magnifier"),
      { type: "begin", point: at(0.3, 0.7) },
      { type: "extend", point: at(0.35, 0.7) },
      { type: "extend", point: at(0.4, 0.75) },
      { type: "end" },
    ]);
    expect(state.strokes[0]?.points).toEqual([at(0.3, 0.7), at(0.4, 0.75)]);
  });

  it("places a spot from the keyboard with the current pen", () => {
    const state = run([
      open,
      withTool("magnifier"),
      { type: "setColor", color: "blue" },
      { type: "place", point: at(0.5, 0.5) },
    ]);
    expect(state.strokes).toEqual([
      {
        tool: "magnifier",
        color: "blue",
        width: "medium",
        style: "solid",
        points: [at(0.5, 0.5), at(0.5 + DEFAULT_SPOT_RADIUS.magnifier, 0.5)],
      },
    ]);
  });

  it("places nothing from the keyboard with a drawing tool picked", () => {
    const state = run([open, { type: "place", point: at(0.5, 0.5) }]);
    expect(state.strokes).toEqual([]);
  });

  it("moves and resizes only the last spot", () => {
    const state = run([
      open,
      withTool("spotlight"),
      { type: "place", point: at(0.2, 0.2) },
      { type: "place", point: at(0.5, 0.5) },
      { type: "moveSpot", dx: 0.1, dy: 0 },
      { type: "resizeSpot", factor: 2 },
    ]);
    expect(state.strokes[0]?.points[0]).toEqual(at(0.2, 0.2));
    expect(state.strokes[1]?.points[0]?.x).toBeCloseTo(0.6);
    expect(spotExtent(state.strokes[1]!)).toBeCloseTo(
      DEFAULT_SPOT_RADIUS.spotlight * 2,
    );
  });

  it("leaves a last stroke that is not a spot alone", () => {
    const drawn = run([
      open,
      { type: "begin", point: at(0.1, 0.1) },
      { type: "extend", point: at(0.4, 0.4) },
      { type: "end" },
    ]);
    expect(run([{ type: "moveSpot", dx: 0.1, dy: 0 }], drawn)).toBe(drawn);
    expect(run([{ type: "resizeSpot", factor: 2 }], drawn)).toBe(drawn);
  });
});
