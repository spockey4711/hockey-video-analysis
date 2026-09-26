import { describe, expect, it } from "vitest";

import {
  boardReducer,
  initialBoardState,
} from "@/features/tactics/board-state";
import { mirrorAxes, mirrorScene, screenFlip } from "@/features/tactics/mirror";
import {
  LINE_TOOLS,
  parseScene,
  PLAY_TOOL_STYLE,
  SCENE_VERSION,
  isPlayTool,
  type BoardLine,
  type TacticsScene,
} from "@/features/tactics/scene";

/** Every line tool: straight, and each play tool bent through a control point too. */
const LINES: BoardLine[] = LINE_TOOLS.flatMap((tool, index) => {
  const base = {
    tool,
    color: "red",
    width: "medium",
    style: isPlayTool(tool) ? PLAY_TOOL_STYLE[tool] : "solid",
    step: 0,
  } as const;
  const straight: BoardLine = {
    ...base,
    id: `l${index * 2 + 1}`,
    points: [
      { x: 10, y: 5 },
      { x: 20.25, y: 15 },
    ],
  };
  const bent: BoardLine = {
    ...base,
    id: `l${index * 2 + 2}`,
    // The control point may lie off the board.
    points: [
      { x: 1, y: 2 },
      { x: -40, y: 70 },
      { x: 12, y: 20 },
    ],
  };
  if (tool === "curve") return [bent];
  return isPlayTool(tool) ? [straight, bent] : [straight];
});

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
    { id: "b1", kind: "ball", x: -2, y: 56 },
  ],
  lines: LINES,
  shapes: [],
  steps: [
    {
      duration: 2,
      moves: [
        { token: "p1", x: 30, y: 25, via: { x: 22.33, y: 3 } },
        { token: "b1", x: 40, y: 10, via: null },
      ],
    },
  ],
};

describe("mirrorScene", () => {
  it("swaps the ends: every token, line point, run target and bend", () => {
    const mirrored = mirrorScene(SCENE, "x");

    expect(mirrored.tokens).toEqual([
      { ...SCENE.tokens[0], x: 81.4, y: 20 },
      { id: "b1", kind: "ball", x: 93.4, y: 56 },
    ]);
    for (const [index, line] of mirrored.lines.entries()) {
      const before = SCENE.lines[index];
      expect(line).toEqual({
        ...before,
        points: before?.points.map((point) => ({
          x: Math.round((91.4 - point.x) * 100) / 100,
          y: point.y,
        })),
      });
    }
    expect(mirrored.steps[0]?.moves).toEqual([
      { token: "p1", x: 61.4, y: 25, via: { x: 69.07, y: 3 } },
      { token: "b1", x: 51.4, y: 10, via: null },
    ]);
  });

  it("swaps the wings: every token, line point, run target and bend", () => {
    const mirrored = mirrorScene(SCENE, "y");

    expect(mirrored.tokens.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 10, y: 35 },
      { x: -2, y: -1 },
    ]);
    const tools = new Set(mirrored.lines.map((line) => line.tool));
    expect([...tools]).toEqual([...LINE_TOOLS]);
    for (const [index, line] of mirrored.lines.entries()) {
      expect(line.points).toEqual(
        SCENE.lines[index]?.points.map((point) => ({
          x: point.x,
          y: 55 - point.y,
        })),
      );
    }
    expect(mirrored.steps[0]?.moves).toEqual([
      { token: "p1", x: 30, y: 30, via: { x: 22.33, y: 52 } },
      { token: "b1", x: 40, y: 45, via: null },
    ]);
  });

  it("stays a valid scene and comes back when mirrored twice", () => {
    for (const axis of ["x", "y"] as const) {
      const mirrored = mirrorScene(SCENE, axis);
      expect(parseScene(mirrored)).toEqual(mirrored);
      expect(mirrorScene(mirrored, axis)).toEqual(SCENE);
    }
  });

  it("only swaps the wings of a short corner, keeping its goal in view", () => {
    const corner = { ...SCENE, view: "corner" } as const;
    expect(mirrorAxes("corner")).toEqual(["y"]);
    expect(mirrorAxes("full")).toEqual(["x", "y"]);
    expect(mirrorScene(corner, "x")).toBe(corner);
    expect(mirrorScene(corner, "y").tokens[0]).toMatchObject({ x: 10, y: 35 });
  });
});

describe("screenFlip", () => {
  it("names the flip by how the board lies on screen", () => {
    expect(screenFlip("x", "none")).toBe("horizontal");
    expect(screenFlip("y", "none")).toBe("vertical");
    expect(screenFlip("x", "left")).toBe("vertical");
    expect(screenFlip("y", "right")).toBe("horizontal");
  });
});

describe("the mirror action", () => {
  it("mirrors the whole scene as one undo step", () => {
    const state = boardReducer(initialBoardState(SCENE), {
      type: "mirror",
      axis: "y",
    });
    expect(state.scene).toEqual(mirrorScene(SCENE, "y"));
    expect(state.past).toEqual([SCENE]);
    expect(boardReducer(state, { type: "undo" }).scene).toBe(SCENE);
  });

  it("leaves a short corner alone when asked to swap its ends", () => {
    const start = initialBoardState({ ...SCENE, view: "corner" });
    expect(boardReducer(start, { type: "mirror", axis: "x" })).toBe(start);
  });
});
