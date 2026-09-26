import { describe, expect, it } from "vitest";

import {
  boardReducer,
  initialBoardState,
  MAX_HISTORY,
  shapeLine,
  type BoardAction,
  type BoardState,
} from "@/features/tactics/board-state";
import {
  defaultScene,
  emptyScene,
  type BoardToken,
} from "@/features/tactics/scene";

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

describe("pitch view", () => {
  it("keeps drags, nudges and bends inside the quarter on show", () => {
    const state = run(
      [
        { type: "grab", id: "p1" },
        { type: "drag", id: "p1", to: { x: 40, y: 20 } },
        { type: "nudge", id: "p2", by: { x: 50, y: 0 } },
      ],
      initialBoardState({ ...defaultScene(), view: "corner" }),
    );
    expect(token(state, "p1")).toMatchObject({ x: 23.9, y: 20 });
    expect(token(state, "p2")).toMatchObject({ x: 23.9, y: 14 });
  });

  it("adds tokens inside the quarter on show", () => {
    const state = run(
      [{ type: "addPlayer", team: "home" }, { type: "addBall" }],
      initialBoardState({ ...emptyScene(), view: "corner", tokens: [] }),
    );
    expect(token(state, "p1")).toMatchObject({ x: 10.45, y: 23.5 });
    expect(token(state, "b1")).toMatchObject({ x: 10.45, y: 27.5 });
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
        step: 0,
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

  it("draws a play tool in its own style, whatever the pen's style", () => {
    const state = run([
      { type: "toggleLineStyle" },
      { type: "setMode", mode: "pass" },
      { type: "setColor", color: "yellow" },
      { type: "lineBegin", at: { x: 10, y: 10 } },
      { type: "lineExtend", at: { x: 20, y: 10 } },
      { type: "lineEnd" },
      { type: "setMode", mode: "run" },
      { type: "toggleLineStyle" },
      { type: "lineBegin", at: { x: 10, y: 20 } },
      { type: "lineExtend", at: { x: 20, y: 20 } },
      { type: "lineEnd" },
    ]);
    expect(
      state.scene.lines.map(({ tool, color, style }) => ({
        tool,
        color,
        style,
      })),
    ).toEqual([
      { tool: "pass", color: "yellow", style: "solid" },
      { tool: "run", color: "yellow", style: "dotted" },
    ]);
  });

  it("keeps a play line straight when the drag only wobbles", () => {
    const state = run([
      { type: "setMode", mode: "dribble" },
      { type: "lineBegin", at: { x: 0, y: 0 } },
      { type: "lineExtend", at: { x: 5, y: 1 } },
      { type: "lineExtend", at: { x: 12, y: -1 } },
      { type: "lineExtend", at: { x: 20, y: 0 } },
      { type: "lineEnd" },
    ]);
    // 1 m off a 20 m line is within the tolerance of 1.6 m.
    expect(state.scene.lines[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
  });

  it("bends a play line through a clear bulge of the drag", () => {
    const state = run([
      { type: "setMode", mode: "block" },
      { type: "lineBegin", at: { x: 0, y: 0 } },
      { type: "lineExtend", at: { x: 10, y: 10 } },
      { type: "lineExtend", at: { x: 20, y: 0 } },
      { type: "lineEnd" },
    ]);
    expect(state.scene.lines[0]).toMatchObject({
      tool: "block",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 20, y: 0 },
      ],
    });
  });

  it("shapes a curve's draft as the release will keep it", () => {
    const state = run([
      { type: "setMode", mode: "curve" },
      { type: "lineBegin", at: { x: 0, y: 0 } },
      { type: "lineExtend", at: { x: 5, y: 7 } },
      { type: "lineExtend", at: { x: 10, y: 10 } },
      { type: "lineExtend", at: { x: 15, y: 7 } },
      { type: "lineExtend", at: { x: 20, y: 0 } },
    ]);
    expect(state.draft?.points).toHaveLength(5);
    // The drawn draft bends through the bulge, not through its first samples.
    expect(state.draft && shapeLine(state.draft)?.points).toEqual([
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

describe("animation steps", () => {
  /** p1 starts at (3, 27.5) in the default lineup. */
  const withStep = (): BoardAction[] => [
    { type: "addStep" },
    { type: "grab", id: "p1" },
    { type: "drag", id: "p1", to: { x: 20, y: 27.5 } },
  ];

  it("adds a step after the one on show and rests on it", () => {
    const state = run([
      { type: "addStep" },
      { type: "setDuration", duration: 3 },
    ]);
    expect(state.step).toBe(1);
    expect(state.scene.steps).toEqual([{ duration: 3, moves: [] }]);
  });

  it("moves a token on a step without touching its start", () => {
    const state = run(withStep());
    expect(token(state, "p1")).toMatchObject({ x: 3, y: 27.5 });
    expect(state.scene.steps[0]?.moves).toEqual([
      { token: "p1", x: 20, y: 27.5, via: null },
    ]);
    expect(state.past).toHaveLength(2);
  });

  it("nudges from where the token stands on the step", () => {
    const state = run([
      ...withStep(),
      { type: "nudge", id: "p1", by: { x: 0.5, y: 0 } },
    ]);
    expect(state.scene.steps[0]?.moves[0]).toMatchObject({ x: 20.5 });
  });

  it("drops a run dragged back to where it started", () => {
    const state = run([
      ...withStep(),
      { type: "drag", id: "p1", to: { x: 3, y: 27.5 } },
    ]);
    expect(state.scene.steps[0]?.moves).toEqual([]);
  });

  it("bends, straightens and resets a run", () => {
    const bent = run([
      ...withStep(),
      { type: "grab", id: "p1" },
      { type: "bend", id: "p1", via: { x: 11.504, y: 20 } },
    ]);
    expect(bent.scene.steps[0]?.moves[0]?.via).toEqual({ x: 11.5, y: 20 });
    const straight = boardReducer(bent, { type: "straighten", id: "p1" });
    expect(straight.scene.steps[0]?.moves[0]?.via).toBeNull();
    const reset = boardReducer(bent, { type: "resetMove", id: "p1" });
    expect(reset.scene.steps[0]?.moves).toEqual([]);
    // Only a token that runs in the step can bend.
    expect(
      boardReducer(bent, { type: "bend", id: "p2", via: { x: 1, y: 1 } }),
    ).toBe(bent);
  });

  it("gives a line drawn on a step to that step", () => {
    const state = run([
      { type: "addStep" },
      { type: "setMode", mode: "line" },
      { type: "lineBegin", at: { x: 0, y: 0 } },
      { type: "lineExtend", at: { x: 10, y: 0 } },
      { type: "lineEnd" },
    ]);
    expect(state.scene.lines[0]?.step).toBe(1);
  });

  it("inserts and removes steps, carrying later lines along", () => {
    const drawOn = (): BoardAction[] => [
      { type: "setMode", mode: "line" },
      { type: "lineBegin", at: { x: 0, y: 0 } },
      { type: "lineExtend", at: { x: 10, y: 0 } },
      { type: "lineEnd" },
    ];
    const state = run([
      { type: "addStep" },
      { type: "addStep" },
      ...drawOn(),
      { type: "goToStep", step: 0 },
      { type: "addStep" },
    ]);
    expect(state.scene.steps).toHaveLength(3);
    expect(state.step).toBe(1);
    expect(state.scene.lines[0]?.step).toBe(3);

    const removed = run(
      [{ type: "goToStep", step: 3 }, { type: "removeStep" }],
      state,
    );
    expect(removed.scene.steps).toHaveLength(2);
    expect(removed.scene.lines).toEqual([]);
    expect(removed.step).toBe(2);
  });

  it("drops a removed token from every step", () => {
    const state = run([...withStep(), { type: "remove", id: "p1" }]);
    expect(state.scene.steps[0]?.moves).toEqual([]);
  });

  it("clamps the step on show when undo takes a step away", () => {
    const state = run([{ type: "addStep" }, { type: "undo" }]);
    expect(state.step).toBe(0);
    expect(state.scene.steps).toEqual([]);
  });
});

describe("playback", () => {
  /** Two steps of 2 s each. */
  const twoSteps = (): BoardState =>
    run([
      { type: "addStep" },
      { type: "addStep" },
      { type: "goToStep", step: 0 },
    ]);

  it("plays from the step on show and rests on the last step at the end", () => {
    let state = run([{ type: "play" }], twoSteps());
    expect(state.playback).toEqual({ time: 0, playing: true });
    state = run([{ type: "tick", seconds: 1.5 }], state);
    expect(state.playback?.time).toBe(1.5);
    state = run([{ type: "tick", seconds: 5 }], state);
    expect(state.playback).toBeNull();
    expect(state.step).toBe(2);
    // Played again from the end, it starts over.
    expect(run([{ type: "play" }], state).playback?.time).toBe(0);
  });

  it("plays faster at a higher speed", () => {
    const state = run(
      [
        { type: "setSpeed", speed: 2 },
        { type: "play" },
        { type: "tick", seconds: 0.5 },
      ],
      twoSteps(),
    );
    expect(state.playback?.time).toBe(1);
  });

  it("pauses partway and carries on from there", () => {
    const paused = run(
      [{ type: "play" }, { type: "tick", seconds: 1 }, { type: "pause" }],
      twoSteps(),
    );
    expect(paused.playback).toEqual({ time: 1, playing: false });
    expect(run([{ type: "tick", seconds: 1 }], paused).playback?.time).toBe(1);
    expect(run([{ type: "play" }], paused).playback).toEqual({
      time: 1,
      playing: true,
    });
  });

  it("steps from a paused moment to the keyframes around it", () => {
    const paused = run([{ type: "seek", time: 3 }], twoSteps());
    expect(paused.playback).toEqual({ time: 3, playing: false });
    expect(run([{ type: "stepBack" }], paused)).toMatchObject({
      step: 1,
      playback: null,
    });
    expect(run([{ type: "stepForward" }], paused)).toMatchObject({
      step: 2,
      playback: null,
    });
  });

  it("rests on a step when seeking onto its keyframe", () => {
    const state = run([{ type: "seek", time: 2 }], twoSteps());
    expect(state).toMatchObject({ step: 1, playback: null });
  });

  it("steps between keyframes at rest, within the ends", () => {
    const state = twoSteps();
    expect(run([{ type: "stepBack" }], state).step).toBe(0);
    expect(
      run(
        [
          { type: "stepForward" },
          { type: "stepForward" },
          { type: "stepForward" },
        ],
        state,
      ).step,
    ).toBe(2);
  });

  it("restarts from the beginning and stops when the board is edited", () => {
    const playing = run(
      [{ type: "goToStep", step: 2 }, { type: "restart" }],
      twoSteps(),
    );
    expect(playing.playback).toEqual({ time: 0, playing: true });
    const edited = run(
      [
        { type: "tick", seconds: 3 },
        { type: "addPlayer", team: "home" },
      ],
      playing,
    );
    expect(edited.playback).toBeNull();
    // It lands on the step that was moving.
    expect(edited.step).toBe(2);
  });

  it("has nothing to play without steps", () => {
    expect(run([{ type: "play" }]).playback).toBeNull();
    expect(run([{ type: "restart" }]).playback).toBeNull();
  });
});

describe("loading a new start", () => {
  it("replaces the board with nothing to undo, keeping the pen and speed", () => {
    const state = run([
      { type: "grab", id: "p1" },
      { type: "drag", id: "p1", to: { x: 10, y: 20 } },
      { type: "setMode", mode: "arrow" },
      { type: "setColor", color: "red" },
      { type: "setSpeed", speed: 2 },
      { type: "load", scene: emptyScene() },
    ]);
    expect(state.scene).toEqual(emptyScene());
    expect(state.past).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    expect(state).toMatchObject({ mode: "arrow", color: "red", speed: 2 });
    expect(boardReducer(state, { type: "undo" }).scene).toEqual(emptyScene());
  });
});
