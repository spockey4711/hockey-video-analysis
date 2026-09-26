import { describe, expect, it } from "vitest";

import { keyframe, shapesForStep } from "@/features/tactics/animation";
import {
  boardReducer,
  initialBoardState,
  MIN_ZONE_SIZE,
  shapeZone,
  type BoardAction,
  type BoardState,
} from "@/features/tactics/board-state";
import { clipOf, parseClip } from "@/features/tactics/clipboard";
import { simplifyPath } from "@/features/tactics/geometry";
import { mirrorScene } from "@/features/tactics/mirror";
import { viewBounds, type PitchPoint } from "@/features/tactics/pitch";
import {
  emptyScene,
  MAX_POLYGON_POINTS,
  MAX_SHAPES,
  newScene,
  parseScene,
  type BoardShape,
  type BoardText,
  type BoardZone,
  type ZoneKind,
} from "@/features/tactics/scene";
import { bubblePath, textBox, zonePath } from "@/features/tactics/shape-paths";
import { itemsInBox, visibleFrame } from "@/features/tactics/visibility";

/** Points from coordinate pairs: `pts(1, 2, 3, 4)` is (1,2) and (3,4). */
function pts(...xy: number[]): PitchPoint[] {
  return xy.flatMap((x, i) =>
    i % 2 === 0 ? [{ x, y: xy[i + 1] ?? Number.NaN }] : [],
  );
}

const BOX: BoardZone = {
  id: "z1",
  kind: "rect",
  color: "red",
  fill: "fill",
  points: pts(10, 10, 20, 18),
  step: 0,
};
const NOTE: BoardText = {
  id: "t1",
  kind: "text",
  color: "white",
  text: "Pressing!",
  bubble: false,
  x: 30,
  y: 12,
  step: 0,
};

/** A board on an empty pitch with these shapes and, optionally, one step. */
function board(shapes: BoardShape[] = [], steps = 0): BoardState {
  const step = { duration: 2, moves: [] };
  return initialBoardState({
    ...emptyScene(),
    shapes,
    steps: Array.from({ length: steps }, () => step),
  });
}

function run(state: BoardState, ...actions: BoardAction[]): BoardState {
  return actions.reduce(boardReducer, state);
}

/** Drag out a zone with a tool through these points. */
function draw(mode: ZoneKind, points: PitchPoint[]): BoardAction[] {
  const [first = { x: 0, y: 0 }, ...rest] = points;
  return [
    { type: "setMode", mode },
    { type: "zoneBegin", at: first },
    ...rest.map((at): BoardAction => ({ type: "zoneExtend", at })),
    { type: "zoneEnd" },
  ];
}

function shape(state: BoardState, id: string) {
  return state.scene.shapes.find((candidate) => candidate.id === id);
}

function ids(shapes: readonly BoardShape[]): string[] {
  return shapes.map((candidate) => candidate.id);
}

describe("drawing zones", () => {
  it("keeps a dragged box as its two corners in the pen and paint, as one undo step", () => {
    const state = run(
      { ...board(), color: "blue" },
      { type: "toggleFill" },
      ...draw("rect", pts(10, 10, 15, 30, 20, 18)),
    );
    expect(state.scene.shapes).toEqual([
      { ...BOX, color: "blue", fill: "hatch" },
    ]);
    expect(state.zoneDraft).toBeNull();
    expect(state.past).toHaveLength(1);
    expect(parseScene(state.scene)).toEqual(state.scene);
    expect(run(state, { type: "undo" }).scene.shapes).toEqual([]);
  });

  it("keeps an oval's corners inside the part of the pitch on show", () => {
    const state = run(
      initialBoardState(newScene("corner")),
      ...draw("ellipse", pts(10, 10, 40, 20)),
    );
    const { maxX } = viewBounds("corner");
    expect(shape(state, "z1")).toMatchObject({
      kind: "ellipse",
      points: pts(10, 10, maxX, 20),
    });
  });

  it("drops a click too small to be a zone", () => {
    const state = run(
      board(),
      ...draw("rect", pts(10, 10, 10 + MIN_ZONE_SIZE, 10.2)),
    );
    expect(state.scene.shapes).toEqual([]);
    expect(state.past).toEqual([]);
  });

  it("finds a polygon's corners in a hand-drawn loop and closes it", () => {
    // A wobbly square round (10,10)-(20,20), drawn back onto its start.
    const side = (at: (i: number) => PitchPoint) =>
      Array.from({ length: 10 }, (_, i) => at(i));
    const loop = [
      ...side((i) => ({ x: 10 + i, y: 10 + (i % 2) * 0.05 })),
      ...side((i) => ({ x: 20, y: 10 + i })),
      ...side((i) => ({ x: 20 - i, y: 20 })),
      ...side((i) => ({ x: 10, y: 20 - i })),
      { x: 10, y: 10 },
    ];
    expect(shape(run(board(), ...draw("polygon", loop)), "z1")).toMatchObject({
      kind: "polygon",
      points: pts(10, 10, 20, 10, 20, 20, 10, 20),
    });
  });

  it("keeps at most the polygon corners a scene may hold", () => {
    const zigzag = Array.from({ length: 200 }, (_, i) => ({
      x: 5 + i * 0.4,
      y: 10 + (i % 2) * 6,
    }));
    const zone = shapeZone({ ...BOX, kind: "polygon", points: zigzag });
    expect(zone?.points.length).toBeLessThanOrEqual(MAX_POLYGON_POINTS);
    expect(
      zone && parseScene({ ...emptyScene(), shapes: [zone] }),
    ).not.toBeNull();
  });

  it("draws no zone with a line tool, no line with a zone tool, none past the limit", () => {
    const at = { x: 10, y: 10 };
    const zoneTool = run(
      board(),
      { type: "setMode", mode: "rect" },
      { type: "lineBegin", at },
    );
    expect(zoneTool.draft).toBeNull();
    const lineTool = run(
      board(),
      { type: "setMode", mode: "arrow" },
      { type: "zoneBegin", at },
    );
    expect(lineTool.zoneDraft).toBeNull();
    const full = board(
      Array.from({ length: MAX_SHAPES }, (_, i) => ({
        ...BOX,
        id: `z${i + 1}`,
      })),
    );
    const refused = run(
      full,
      { type: "setMode", mode: "rect" },
      { type: "zoneBegin", at },
    );
    expect(refused.zoneDraft).toBeNull();
  });
});

describe("texts", () => {
  it("puts a text down in the pen, selects it and goes back to moving", () => {
    const state = run(
      board(),
      { type: "setMode", mode: "text" },
      { type: "addText", at: { x: 30, y: 12 }, text: "Text" },
    );
    expect(state.scene.shapes).toEqual([{ ...NOTE, text: "Text" }]);
    expect(state.selectedIds).toEqual(["t1"]);
    expect(state.mode).toBe("move");
  });

  it("changes the words and the bubble, keeping the last words for an empty field", () => {
    const state = run(
      board([NOTE]),
      { type: "setText", id: "t1", text: "  Raum  eng " },
      { type: "setText", id: "t1", text: "   " },
      { type: "setBubble", id: "t1", bubble: true },
    );
    expect(shape(state, "t1")).toMatchObject({
      text: "Raum eng",
      bubble: true,
    });
    expect(state.past).toHaveLength(2);
  });
});

describe("zones and texts on the board", () => {
  it("moves, nudges and removes a zone and a text with the selection", () => {
    const moved = run(
      board([BOX, NOTE]),
      { type: "selectMany", ids: ["z1", "t1"] },
      { type: "grab", id: "z1" },
      { type: "drag", id: "z1", to: { x: 12, y: 11 } },
      { type: "nudge", id: "t1", by: { x: 0.5, y: 0 } },
    );
    expect(shape(moved, "z1")).toMatchObject({
      points: pts(12.5, 11, 22.5, 19),
    });
    expect(shape(moved, "t1")).toMatchObject({ x: 32.5, y: 13 });
    expect(moved.past).toHaveLength(2);
    expect(run(moved, { type: "remove", id: "t1" }).scene.shapes).toEqual([]);
  });

  it("stops a group at the edge of the pitch in one piece", () => {
    const state = run(
      board([BOX]),
      { type: "select", id: "z1" },
      { type: "nudge", id: "z1", by: { x: -50, y: 0 } },
    );
    const { minX } = viewBounds("full");
    expect(shape(state, "z1")).toMatchObject({
      points: pts(minX, 10, minX + 10, 18),
    });
  });

  it("gives a shape to the step it was drawn on, and moves it with its step", () => {
    const drawn = run(
      board([BOX], 1),
      { type: "goToStep", step: 1 },
      { type: "setMode", mode: "text" },
      { type: "addText", at: { x: 30, y: 12 }, text: "Jetzt!" },
    );
    expect(shape(drawn, "t1")?.step).toBe(1);
    expect(ids(shapesForStep(drawn.scene, 0))).toEqual(["z1"]);
    expect(ids(shapesForStep(drawn.scene, 1))).toEqual(["z1", "t1"]);
    // A step put in before it carries it along; removing its step takes it.
    const inserted = run(
      drawn,
      { type: "goToStep", step: 0 },
      { type: "addStep" },
    );
    expect(shape(inserted, "t1")?.step).toBe(2);
    const removed = run(inserted, { type: "removeStep" });
    expect(shape(removed, "t1")?.step).toBe(1);
    const gone = run(
      removed,
      { type: "goToStep", step: 1 },
      { type: "removeStep" },
    );
    expect(ids(gone.scene.shapes)).toEqual(["z1"]);
  });

  it("lets go of a selected shape on a step that does not show it", () => {
    const state = run(
      board([{ ...NOTE, step: 1 }], 1),
      { type: "goToStep", step: 1 },
      { type: "select", id: "t1" },
      { type: "goToStep", step: 0 },
    );
    expect(state.selectedIds).toEqual([]);
  });

  it("clears the step's zones and texts with its lines", () => {
    const state = run(board([BOX, NOTE]), { type: "clearLines" });
    expect(state.scene.shapes).toEqual([]);
    expect(run(state, { type: "undo" }).scene.shapes).toHaveLength(2);
  });

  it("mirrors zones' corners and texts' points, the words unchanged", () => {
    const scene = { ...emptyScene(), shapes: [BOX, NOTE] };
    expect(mirrorScene(scene, "y").shapes).toEqual([
      { ...BOX, points: pts(10, 45, 20, 37) },
      { ...NOTE, y: 43 },
    ]);
    const ends = mirrorScene(scene, "x");
    expect(ends.shapes[1]).toMatchObject({ x: 61.4, y: 12, text: "Pressing!" });
    expect(mirrorScene(ends, "x")).toEqual(scene);
  });

  it("copies and pastes zones and texts onto the step on show, beside the originals", () => {
    const start = run(board([BOX, NOTE]), {
      type: "selectMany",
      ids: ["z1", "t1"],
    });
    const clip = clipOf(start);
    expect(clip?.shapes).toEqual([BOX, NOTE]);
    const stored = parseClip(JSON.parse(JSON.stringify(clip)));
    expect(stored).toEqual(clip);
    if (!stored) throw new Error("clip must parse");
    const pasted = run(start, { type: "paste", clip: stored });
    expect(pasted.selectedIds).toEqual(["z2", "t2"]);
    expect(shape(pasted, "t2")).toMatchObject({ x: 32.4, y: 14.4 });
    // A clip kept before zones and texts existed has none.
    const ball = { id: "b1", kind: "ball", x: 5, y: 5 };
    const before = { view: "full", tokens: [ball], lines: [] };
    expect(parseClip(before)?.shapes).toEqual([]);
  });

  it("boxes in the zones whose corners and the texts whose point lie inside", () => {
    const frame = keyframe({ ...emptyScene(), shapes: [BOX, NOTE] }, 0);
    expect(itemsInBox(frame, { x: 5, y: 5 }, { x: 25, y: 25 })).toEqual(["z1"]);
    expect(itemsInBox(frame, { x: 5, y: 5 }, { x: 35, y: 25 })).toContain("t1");
  });

  it("hides the zones and texts wholly outside a short-corner quarter", () => {
    const shapes = [
      { ...BOX, id: "z2", points: pts(60, 10, 70, 20) },
      { ...BOX, id: "z3", points: pts(20, 10, 70, 20) },
      { ...NOTE, x: 50 },
    ];
    const frame = keyframe({ ...emptyScene(), shapes }, 0);
    const shown = visibleFrame(frame, viewBounds("corner"), 0.3);
    expect(ids(shown.shapes)).toEqual(["z3"]);
  });
});

describe("zone and text drawing", () => {
  it("draws a box, the oval in it and a closed polygon", () => {
    expect(zonePath(BOX)).toBe("M10 10H20V18H10Z");
    expect(zonePath({ ...BOX, kind: "ellipse" })).toBe(
      "M10 14A5 4 0 1 0 20 14A5 4 0 1 0 10 14Z",
    );
    expect(
      zonePath({ ...BOX, kind: "polygon", points: pts(1, 2, 3, 4, 5, 2) }),
    ).toBe("M1 2L3 4L5 2Z");
  });

  it("sizes a text's box by its length, larger in a bubble", () => {
    const plain = textBox("Pressing!", 2, false);
    const bubble = textBox("Pressing!", 2, true);
    expect(plain.width).toBeCloseTo((9 * 0.6 + 0.4) * 2);
    expect(bubble.width).toBeGreaterThan(plain.width);
    expect(bubble.height).toBeGreaterThan(plain.height);
    // The tail reaches below the box.
    expect(bubblePath(bubble, 2)).toMatch(/L[-\d.]+ 3L/);
  });

  it("simplifies a hand-drawn path to its ends and corners", () => {
    const path = pts(0, 0, 5, 0.05, 10, 0, 10, 5, 10, 10);
    expect(simplifyPath(path, 0.1)).toEqual(pts(0, 0, 10, 0, 10, 10));
    expect(simplifyPath(path.slice(0, 2), 0.1)).toEqual(path.slice(0, 2));
  });
});
