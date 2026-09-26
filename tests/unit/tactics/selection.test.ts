import { describe, expect, it } from "vitest";

import { keyframe } from "@/features/tactics/animation";
import {
  boardReducer,
  initialBoardState,
  type BoardAction,
  type BoardState,
} from "@/features/tactics/board-state";
import {
  defaultScene,
  type BoardLine,
  type TacticsScene,
} from "@/features/tactics/scene";
import { itemsInBox } from "@/features/tactics/visibility";

/** A pass from p2 towards p3, and a bent run whose control point lies off the board. */
const LINES: BoardLine[] = [
  {
    id: "l1",
    tool: "pass",
    color: "white",
    width: "medium",
    style: "solid",
    points: [
      { x: 16, y: 14 },
      { x: 16, y: 27.5 },
    ],
    step: 0,
  },
  {
    id: "l2",
    tool: "run",
    color: "white",
    width: "medium",
    style: "dotted",
    points: [
      { x: 20, y: 10 },
      { x: 20, y: -101 },
      { x: 30, y: 10 },
    ],
    step: 0,
  },
];

const SCENE: TacticsScene = { ...defaultScene(), lines: LINES };

function run(actions: BoardAction[], state = initialBoardState(SCENE)) {
  return actions.reduce(boardReducer, state);
}

function at(state: BoardState, id: string) {
  const token = state.scene.tokens.find((candidate) => candidate.id === id);
  return token && { x: token.x, y: token.y };
}

function points(state: BoardState, id: string) {
  return state.scene.lines.find((line) => line.id === id)?.points;
}

describe("selecting several", () => {
  it("adds and takes out with a toggle, and a plain select starts over", () => {
    const state = run([
      { type: "select", id: "p1" },
      { type: "toggleSelect", id: "p2" },
      { type: "toggleSelect", id: "l1" },
      { type: "toggleSelect", id: "p1" },
    ]);
    expect(state.selectedIds).toEqual(["p2", "l1"]);
    expect(run([{ type: "select", id: "p5" }], state).selectedIds).toEqual([
      "p5",
    ]);
    expect(run([{ type: "select", id: null }], state).selectedIds).toEqual([]);
  });

  it("adds a box's catch to the selection, each id once", () => {
    const state = run([
      { type: "select", id: "p2" },
      { type: "selectMany", ids: ["p2", "p3", "l1"] },
    ]);
    expect(state.selectedIds).toEqual(["p2", "p3", "l1"]);
  });

  it("keeps the selection when focus lands on a selected item", () => {
    const state = run([{ type: "selectMany", ids: ["p2", "p3"] }]);
    expect(run([{ type: "focus", id: "p3" }], state)).toBe(state);
    expect(run([{ type: "focus", id: "p4" }], state).selectedIds).toEqual([
      "p4",
    ]);
  });
});

describe("moving a group", () => {
  const picked = [{ type: "selectMany", ids: ["p2", "p3", "l1"] }] as const;

  it("drags every selected token and line by the same amount, as one undo step", () => {
    const state = run([
      ...picked,
      { type: "grab", id: "p3" },
      { type: "drag", id: "p3", to: { x: 18, y: 30 } },
      { type: "drag", id: "p3", to: { x: 20, y: 30 } },
    ]);
    expect(state.selectedIds).toEqual(["p2", "p3", "l1"]);
    expect(at(state, "p2")).toEqual({ x: 20, y: 16.5 });
    expect(at(state, "p3")).toEqual({ x: 20, y: 30 });
    expect(points(state, "l1")).toEqual([
      { x: 20, y: 16.5 },
      { x: 20, y: 30 },
    ]);
    expect(at(state, "p4")).toEqual(at(initialBoardState(SCENE), "p4"));
    expect(state.past).toHaveLength(1);
    expect(run([{ type: "undo" }], state).scene).toEqual(SCENE);
  });

  it("drags a line by its start, alone when it is not selected", () => {
    const state = run([
      { type: "grab", id: "l1" },
      { type: "drag", id: "l1", to: { x: 10, y: 20 } },
    ]);
    expect(state.selectedIds).toEqual(["l1"]);
    expect(points(state, "l1")).toEqual([
      { x: 10, y: 20 },
      { x: 10, y: 33.5 },
    ]);
    expect(at(state, "p2")).toEqual({ x: 16, y: 14 });
  });

  it("stops the whole group at the edge, keeping its shape", () => {
    const state = run([
      ...picked,
      { type: "grab", id: "p2" },
      { type: "drag", id: "p2", to: { x: 16, y: -50 } },
    ]);
    // p2 reaches the board's top edge; p3 stays 13.5 m below it.
    expect(at(state, "p2")).toEqual({ x: 16, y: -2 });
    expect(at(state, "p3")).toEqual({ x: 16, y: 11.5 });
  });

  it("keeps a moved curve's control point within reach of the board", () => {
    const state = run([{ type: "nudge", id: "l2", by: { x: 0, y: -5 } }]);
    expect(points(state, "l2")).toEqual([
      { x: 20, y: 5 },
      { x: 20, y: -102 },
      { x: 30, y: 5 },
    ]);
  });

  it("nudges the group from a selected item, and only the item otherwise", () => {
    const group = run([
      ...picked,
      { type: "nudge", id: "l1", by: { x: 1, y: 0 } },
    ]);
    expect(at(group, "p2")).toEqual({ x: 17, y: 14 });
    expect(at(group, "p3")).toEqual({ x: 17, y: 27.5 });

    const alone = run([
      ...picked,
      { type: "nudge", id: "p4", by: { x: 1, y: 0 } },
    ]);
    expect(at(alone, "p4")).toEqual({ x: 17, y: 41 });
    expect(at(alone, "p2")).toEqual({ x: 16, y: 14 });
  });

  it("moves the group's run targets on a later step, the lines as drawn", () => {
    const state = run([
      { type: "addStep" },
      ...picked,
      { type: "nudge", id: "p2", by: { x: 2, y: 0 } },
    ]);
    // Step 0 is untouched; step 1 runs both tokens 2 m on.
    expect(at(state, "p2")).toEqual({ x: 16, y: 14 });
    expect(state.scene.steps[0]?.moves).toEqual([
      { token: "p2", x: 18, y: 14, via: null },
      { token: "p3", x: 18, y: 27.5, via: null },
    ]);
    expect(points(state, "l1")?.[0]).toEqual({ x: 18, y: 14 });
  });

  it("removes the whole selection and the tokens' runs", () => {
    const moved = run([
      { type: "addStep" },
      { type: "nudge", id: "p2", by: { x: 2, y: 0 } },
      { type: "goToStep", step: 0 },
      ...picked,
      { type: "remove", id: "p3" },
    ]);
    expect(moved.scene.tokens.map((token) => token.id)).not.toContain("p2");
    expect(moved.scene.tokens.map((token) => token.id)).not.toContain("p3");
    expect(moved.scene.lines.map((line) => line.id)).toEqual(["l2"]);
    expect(moved.scene.steps[0]?.moves).toEqual([]);
    expect(moved.selectedIds).toEqual([]);
  });

  it("drops selected lines a step does not show", () => {
    const state = run([
      { type: "addStep" },
      { type: "setMode", mode: "pass" },
      { type: "lineBegin", at: { x: 40, y: 40 } },
      { type: "lineExtend", at: { x: 50, y: 40 } },
      { type: "lineEnd" },
      { type: "setMode", mode: "move" },
      { type: "selectMany", ids: ["l3", "l1", "p1"] },
      { type: "goToStep", step: 0 },
    ]);
    expect(state.selectedIds).toEqual(["l1", "p1"]);
  });
});

describe("itemsInBox", () => {
  it("takes the tokens whose centre and the lines whose ends lie inside", () => {
    const frame = keyframe(SCENE, 0);
    expect(itemsInBox(frame, { x: 17, y: 28 }, { x: 15, y: 10 })).toEqual([
      "p2",
      "p3",
      "l1",
    ]);
    // The run's control point lies far outside; its ends decide.
    expect(itemsInBox(frame, { x: 19, y: 9 }, { x: 31, y: 11 })).toEqual([
      "l2",
    ]);
  });
});
