import { describe, expect, it } from "vitest";

import {
  ease,
  frameAt,
  keyframe,
  keyframeTimes,
  movePath,
  pointOnPath,
  sceneDuration,
  stepAtTime,
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
  tokens: [
    {
      id: "p1",
      kind: "player",
      team: "home",
      label: "7",
      playerId: null,
      x: 10,
      y: 20,
    },
    { id: "b1", kind: "ball", x: 10, y: 30 },
  ],
  lines: [line("l1", 0), line("l2", 1), line("l3", 2)],
  steps: [
    { duration: 2, moves: [{ token: "p1", x: 20, y: 20, via: null }] },
    {
      duration: 1,
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
