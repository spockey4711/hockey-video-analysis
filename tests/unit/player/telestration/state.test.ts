import { describe, expect, it } from "vitest";

import {
  initialTelestrationState,
  isStrokeWidth,
  nextStrokeWidth,
  STROKE_WIDTHS,
  telestrationReducer,
  type TelestrationAction,
  type TelestrationState,
} from "@/features/player/telestration/state";

function run(
  actions: readonly TelestrationAction[],
  from: TelestrationState = initialTelestrationState,
): TelestrationState {
  return actions.reduce(telestrationReducer, from);
}

const open: TelestrationAction = { type: "open" };
const at = (x: number, y: number) => ({ x, y });

describe("telestrationReducer", () => {
  it("ignores a drag while the layer is closed", () => {
    const state = run([{ type: "begin", point: at(0.1, 0.1) }]);
    expect(state.draft).toBeNull();
  });

  it("keeps an arrow as its tail and the latest tip", () => {
    const state = run([
      open,
      { type: "begin", point: at(0.1, 0.1) },
      { type: "extend", point: at(0.3, 0.2) },
      { type: "extend", point: at(0.5, 0.4) },
      { type: "end" },
    ]);
    expect(state.strokes).toEqual([
      {
        tool: "arrow",
        color: "red",
        width: "medium",
        points: [at(0.1, 0.1), at(0.5, 0.4)],
      },
    ]);
    expect(state.draft).toBeNull();
  });

  it("keeps every sampled point of a freehand line", () => {
    const state = run([
      open,
      { type: "setTool", tool: "freehand" },
      { type: "setColor", color: "yellow" },
      { type: "begin", point: at(0.1, 0.1) },
      { type: "extend", point: at(0.2, 0.15) },
      { type: "extend", point: at(0.3, 0.1) },
      { type: "end" },
    ]);
    expect(state.strokes[0]).toEqual({
      tool: "freehand",
      color: "yellow",
      width: "medium",
      points: [at(0.1, 0.1), at(0.2, 0.15), at(0.3, 0.1)],
    });
  });

  it("drops a circle or arrow that is really just a click", () => {
    const state = run([
      open,
      { type: "setTool", tool: "circle" },
      { type: "begin", point: at(0.5, 0.5) },
      { type: "extend", point: at(0.503, 0.502) },
      { type: "end" },
    ]);
    expect(state.strokes).toEqual([]);
  });

  it("keeps a freehand click as a dot", () => {
    const state = run([
      open,
      { type: "setTool", tool: "freehand" },
      { type: "begin", point: at(0.5, 0.5) },
      { type: "end" },
    ]);
    expect(state.strokes).toHaveLength(1);
  });

  it("undoes the last stroke, then the one before", () => {
    const drawn = run([
      open,
      { type: "begin", point: at(0.1, 0.1) },
      { type: "extend", point: at(0.5, 0.5) },
      { type: "end" },
      { type: "begin", point: at(0.6, 0.1) },
      { type: "extend", point: at(0.9, 0.5) },
      { type: "end" },
    ]);
    const once = telestrationReducer(drawn, { type: "undo" });
    expect(once.strokes).toEqual([drawn.strokes[0]]);
    expect(telestrationReducer(once, { type: "undo" }).strokes).toEqual([]);
  });

  it("draws each stroke with the width picked when it began", () => {
    const state = run([
      open,
      { type: "setWidth", width: "thick" },
      { type: "begin", point: at(0.1, 0.1) },
      { type: "extend", point: at(0.5, 0.5) },
      { type: "end" },
      { type: "cycleWidth" },
      { type: "begin", point: at(0.6, 0.1) },
      { type: "extend", point: at(0.9, 0.5) },
      { type: "end" },
    ]);
    expect(state.strokes.map((stroke) => stroke.width)).toEqual([
      "thick",
      "thin",
    ]);
    expect(state.width).toBe("thin");
  });

  it("discards the drawing on close but remembers tool, pen and width", () => {
    const state = run([
      open,
      { type: "setTool", tool: "circle" },
      { type: "setColor", color: "blue" },
      { type: "setWidth", width: "thin" },
      { type: "begin", point: at(0.1, 0.1) },
      { type: "extend", point: at(0.5, 0.5) },
      { type: "end" },
      { type: "close" },
    ]);
    expect(state).toMatchObject({
      active: false,
      tool: "circle",
      color: "blue",
      width: "thin",
      strokes: [],
      draft: null,
    });
  });

  it("clears every stroke but stays open", () => {
    const state = run([
      open,
      { type: "begin", point: at(0.1, 0.1) },
      { type: "extend", point: at(0.5, 0.5) },
      { type: "end" },
      { type: "clear" },
    ]);
    expect(state.strokes).toEqual([]);
    expect(state.active).toBe(true);
  });
});

describe("stroke widths", () => {
  it("starts on the medium step", () => {
    expect(initialTelestrationState.width).toBe("medium");
  });

  it("cycles thin, medium, thick and wraps back to thin", () => {
    expect(STROKE_WIDTHS).toEqual(["thin", "medium", "thick"]);
    expect(nextStrokeWidth("thin")).toBe("medium");
    expect(nextStrokeWidth("medium")).toBe("thick");
    expect(nextStrokeWidth("thick")).toBe("thin");
  });

  it("accepts only a known step from untrusted storage", () => {
    expect(isStrokeWidth("thick")).toBe(true);
    expect(isStrokeWidth("huge")).toBe(false);
    expect(isStrokeWidth(null)).toBe(false);
  });
});
