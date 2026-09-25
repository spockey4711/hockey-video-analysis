import { describe, expect, it } from "vitest";

import {
  boardReducer,
  initialBoardState,
  MAX_HISTORY,
  type BoardAction,
  type BoardState,
} from "@/features/tactics/board-state";
import { defaultScene, type BoardToken } from "@/features/tactics/scene";

function run(
  actions: BoardAction[],
  state = initialBoardState(defaultScene()),
) {
  return actions.reduce(boardReducer, state);
}

function token(state: BoardState, id: string): BoardToken | undefined {
  return state.scene.tokens.find((candidate) => candidate.id === id);
}

describe("moving tokens", () => {
  it("drags a token to the pointer, clamped to the board, as one undo step", () => {
    const state = run([
      { type: "grab", id: "p1" },
      { type: "drag", id: "p1", to: { x: 10.123, y: 20 } },
      { type: "drag", id: "p1", to: { x: 500, y: 20 } },
    ]);
    expect(token(state, "p1")).toMatchObject({ x: 94.4, y: 20 });
    expect(state.selectedId).toBe("p1");
    expect(state.past).toHaveLength(1);

    const undone = boardReducer(state, { type: "undo" });
    expect(token(undone, "p1")).toMatchObject({ x: 3, y: 27.5 });
  });

  it("adds no undo step for a press without a move", () => {
    expect(run([{ type: "grab", id: "p1" }]).past).toHaveLength(0);
  });

  it("nudges a token by a step", () => {
    const state = run([{ type: "nudge", id: "p2", by: { x: 0.5, y: -5 } }]);
    expect(token(state, "p2")).toMatchObject({ x: 16.5, y: 9 });
  });
});

describe("adding and removing", () => {
  it("adds a numbered player in the team's half and selects it", () => {
    const state = run([{ type: "addPlayer", team: "away" }]);
    expect(token(state, "p23")).toEqual({
      id: "p23",
      kind: "player",
      team: "away",
      label: "12",
      playerId: null,
      x: 68.55,
      y: 27.5,
    });
    expect(state.selectedId).toBe("p23");
  });

  it("keeps a single ball", () => {
    const state = run([{ type: "addBall" }]);
    expect(state.scene.tokens.filter((t) => t.kind === "ball")).toHaveLength(1);
    const readded = run([{ type: "remove", id: "b1" }, { type: "addBall" }]);
    expect(readded.scene.tokens.filter((t) => t.kind === "ball")).toHaveLength(
      1,
    );
  });

  it("removes the selected token and relabels a player with a roster link", () => {
    const state = run([
      { type: "setLabel", id: "p3", label: "TW", playerId: "x" },
      { type: "remove", id: "p4" },
    ]);
    expect(token(state, "p3")).toMatchObject({ label: "TW", playerId: "x" });
    expect(token(state, "p4")).toBeUndefined();
  });
});

describe("drawing lines", () => {
  it("keeps a dragged arrow as its two ends in the current pen", () => {
    const state = run([
      { type: "setMode", mode: "arrow" },
      { type: "setColor", color: "red" },
      { type: "toggleLineStyle" },
      { type: "lineBegin", at: { x: 10, y: 10 } },
      { type: "lineExtend", at: { x: 15, y: 12 } },
      { type: "lineExtend", at: { x: 20, y: 10 } },
      { type: "lineEnd" },
    ]);
    expect(state.scene.lines).toEqual([
      {
        id: "l1",
        tool: "arrow",
        color: "red",
        width: "medium",
        style: "dotted",
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
        ],
      },
    ]);
    expect(state.draft).toBeNull();
  });

  it("bends a curve through the farthest point of the drag", () => {
    const state = run([
      { type: "setMode", mode: "curve" },
      { type: "lineBegin", at: { x: 0, y: 0 } },
      { type: "lineExtend", at: { x: 10, y: 10 } },
      { type: "lineExtend", at: { x: 20, y: 0 } },
      { type: "lineEnd" },
    ]);
    // Through (10, 10) at the middle: the control point sits twice as high.
    expect(state.scene.lines[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 0 },
    ]);
  });

  it("drops a click that is too short to be a line", () => {
    const state = run([
      { type: "setMode", mode: "line" },
      { type: "lineBegin", at: { x: 5, y: 5 } },
      { type: "lineExtend", at: { x: 5.2, y: 5.1 } },
      { type: "lineEnd" },
    ]);
    expect(state.scene.lines).toEqual([]);
    expect(state.past).toHaveLength(0);
  });

  it("draws nothing while moving", () => {
    const state = run([{ type: "lineBegin", at: { x: 5, y: 5 } }]);
    expect(state.draft).toBeNull();
  });

  it("clears every line in one undoable step", () => {
    const drawn = run([
      { type: "setMode", mode: "line" },
      { type: "lineBegin", at: { x: 0, y: 0 } },
      { type: "lineExtend", at: { x: 10, y: 0 } },
      { type: "lineEnd" },
      { type: "clearLines" },
    ]);
    expect(drawn.scene.lines).toEqual([]);
    expect(boardReducer(drawn, { type: "undo" }).scene.lines).toHaveLength(1);
  });
});

it("remembers at most the last MAX_HISTORY steps", () => {
  const actions: BoardAction[] = Array.from(
    { length: MAX_HISTORY + 5 },
    () => ({
      type: "nudge",
      id: "p1",
      by: { x: 0.5, y: 0 },
    }),
  );
  expect(run(actions).past).toHaveLength(MAX_HISTORY);
});
