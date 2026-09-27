import { describe, expect, it } from "vitest";

import {
  ease,
  frameAt,
  isHolding,
  keyframe,
  keyframeTimes,
  movePath,
  pointOnPath,
  sceneDuration,
  stepAtTime,
  stepStartTimes,
} from "@/features/tactics/animation";
import {
  SCENE_VERSION,
  type BoardLine,
  type TacticsScene,
} from "@/features/tactics/scene";

function line(id: string, step: number): BoardLine {
  return {
    id,
    tool: "arrow",
    color: "white",
    width: "medium",
    style: "solid",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    step,
  };
}

/**
 * Player p1 runs 10 m right in step 1 (2 s), then the ball follows a bent
 * path in step 2 (1 s) while p1 stands still.
 */
const SCENE: TacticsScene = {
  version: SCENE_VERSION,
  view: "full",
  tokens: [
    {
      id: "p1",
      kind: "player",
      team: "home",
      label: "7",
      position: "",
      playerId: null,
      x: 10,
      y: 20,
    },
    { id: "b1", kind: "ball", x: 10, y: 30 },
  ],
  lines: [line("l1", 0), line("l2", 1), line("l3", 2)],
  shapes: [],
  startCaption: "",
  steps: [
    {
      duration: 2,
      hold: 0,
      caption: "",
      moves: [{ token: "p1", x: 20, y: 20, via: null }],
    },
    {
      duration: 1,
      hold: 0,
      caption: "",
      moves: [{ token: "b1", x: 30, y: 30, via: { x: 20, y: 25 } }],
    },
  ],
};

function at(time: number, id: string) {
  const token = frameAt(SCENE, time).tokens.find((t) => t.id === id);
  return token && { x: token.x, y: token.y };
}

describe("step timing", () => {
  it("lays the steps end to end", () => {
    expect(keyframeTimes(SCENE)).toEqual([0, 2, 3]);
    expect(sceneDuration(SCENE)).toBe(3);
  });

  it("shows a step while it moves and when it arrives", () => {
    expect(stepAtTime(SCENE, 0)).toBe(0);
    expect(stepAtTime(SCENE, 0.01)).toBe(1);
    expect(stepAtTime(SCENE, 2)).toBe(1);
    expect(stepAtTime(SCENE, 2.5)).toBe(2);
    expect(stepAtTime(SCENE, 3)).toBe(2);
    expect(stepAtTime(SCENE, 99)).toBe(2);
  });

  it("has nothing to play without steps", () => {
    const still = { ...SCENE, steps: [], lines: [] };
    expect(sceneDuration(still)).toBe(0);
    expect(stepAtTime(still, 1)).toBe(0);
    expect(frameAt(still, 1).tokens).toEqual(still.tokens);
  });
});

describe("interpolation", () => {
  it("eases in and out between 0 and 1", () => {
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
    expect(ease(0.25)).toBeLessThan(0.25);
    expect(ease(0.75)).toBeGreaterThan(0.75);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });

  it("runs a token straight from its last position to its target", () => {
    expect(at(0, "p1")).toEqual({ x: 10, y: 20 });
    expect(at(1, "p1")).toEqual({ x: 15, y: 20 });
    expect(at(2, "p1")).toEqual({ x: 20, y: 20 });
    // Eased: a quarter of the time covers less than a quarter of the way.
    expect(at(0.5, "p1")?.x).toBeLessThan(12.5);
  });

  it("keeps a token still in a step it does not move in", () => {
    expect(at(1, "b1")).toEqual({ x: 10, y: 30 });
    expect(at(2.5, "p1")).toEqual({ x: 20, y: 20 });
  });

  it("bends a run through its via halfway", () => {
    expect(at(2.5, "b1")).toEqual({ x: 20, y: 25 });
    expect(at(3, "b1")).toEqual({ x: 30, y: 30 });
    expect(at(10, "b1")).toEqual({ x: 30, y: 30 });
  });

  it("puts a straight run's control point on the line", () => {
    const path = movePath(
      { x: 0, y: 0 },
      { token: "p1", x: 10, y: 0, via: null },
    );
    expect(path.control).toEqual({ x: 5, y: 0 });
    expect(pointOnPath(path, 0.3)).toEqual({ x: 3, y: 0 });
  });
});

describe("frames", () => {
  it("shows start lines throughout and a step's lines only on that step", () => {
    const ids = (time: number) =>
      frameAt(SCENE, time).lines.map((shown) => shown.id);
    expect(ids(0)).toEqual(["l1"]);
    expect(ids(1)).toEqual(["l1", "l2"]);
    expect(ids(2)).toEqual(["l1", "l2"]);
    expect(ids(2.5)).toEqual(["l1", "l3"]);
  });

  it("rests on a keyframe as the animation shows it", () => {
    expect(keyframe(SCENE, 1)).toEqual(frameAt(SCENE, 2));
    expect(keyframe(SCENE, 2)).toEqual(frameAt(SCENE, 3));
    expect(keyframe(SCENE, 9).step).toBe(2);
  });

  it("keeps each token's identity and order", () => {
    const frame = frameAt(SCENE, 1.2);
    expect(frame.tokens.map((token) => token.id)).toEqual(["p1", "b1"]);
    expect(frame.tokens[0]).toMatchObject({ kind: "player", label: "7" });
  });
});

describe("holds and captions", () => {
  /** Step 1 moves over 0-2 s and holds 2-3.5 s; step 2 moves over 3.5-4.5 s. */
  const HELD: TacticsScene = {
    ...SCENE,
    startCaption: "Start",
    steps: SCENE.steps.map((step, index) =>
      index === 0
        ? { ...step, hold: 1.5, caption: "Laufweg" }
        : { ...step, caption: "Pass" },
    ),
  };
  const heldAt = (time: number, id: string) =>
    frameAt(HELD, time).tokens.find((token) => token.id === id);

  it("starts the next step once the step before has held", () => {
    expect(stepStartTimes(HELD)).toEqual([0, 3.5]);
    expect(keyframeTimes(HELD)).toEqual([0, 2, 4.5]);
    expect(sceneDuration(HELD)).toBe(4.5);
  });

  it("stands still on the step through its hold", () => {
    expect(stepAtTime(HELD, 3)).toBe(1);
    expect(stepAtTime(HELD, 3.5)).toBe(1);
    expect(stepAtTime(HELD, 3.6)).toBe(2);
    expect(heldAt(2.5, "p1")).toMatchObject({ x: 20, y: 20 });
    expect(heldAt(3.5, "b1")).toMatchObject({ x: 10, y: 30 });
    expect(heldAt(4, "b1")).toMatchObject({ x: 20, y: 25 });
    expect(frameAt(HELD, 3)).toEqual(keyframe(HELD, 1));
  });

  it("tells a hold from a move", () => {
    expect(isHolding(HELD, 0)).toBe(false);
    expect(isHolding(HELD, 1)).toBe(false);
    expect(isHolding(HELD, 2)).toBe(true);
    expect(isHolding(HELD, 3)).toBe(true);
    expect(isHolding(HELD, 4)).toBe(false);
    expect(isHolding(HELD, 4.5)).toBe(true);
  });

  it("shows the caption of the step on show", () => {
    expect(frameAt(HELD, 0).caption).toBe("Start");
    expect(frameAt(HELD, 1).caption).toBe("Laufweg");
    expect(frameAt(HELD, 3).caption).toBe("Laufweg");
    expect(frameAt(HELD, 4).caption).toBe("Pass");
    expect(keyframe(HELD, 0).caption).toBe("Start");
    expect(frameAt(SCENE, 1).caption).toBe("");
  });
});
