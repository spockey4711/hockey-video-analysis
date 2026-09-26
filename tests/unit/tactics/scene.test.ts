import { describe, expect, it } from "vitest";

import {
  defaultScene,
  emptyScene,
  MAX_SCENE_JSON_LENGTH,
  MAX_STEPS,
  MAX_TOKENS,
  nextId,
  parseScene,
  parseSceneJson,
  SCENE_VERSION,
} from "@/features/tactics/scene";

const PLAYER_ID = "33333333-3333-4333-8333-333333333333";

function scene(overrides: Record<string, unknown> = {}) {
  return {
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
      { id: "b1", kind: "ball", x: 45.7, y: 27.5 },
    ],
    lines: [
      {
        id: "l1",
        tool: "curve",
        color: "yellow",
        width: "medium",
        style: "dotted",
        points: [
          { x: 10, y: 20 },
          { x: 20, y: -40 },
          { x: 30, y: 20 },
        ],
        step: 1,
      },
    ],
    steps: [
      {
        duration: 2,
        moves: [
          { token: "p1", x: 30, y: 20, via: { x: 20, y: 10 } },
          { token: "b1", x: 30, y: 21, via: null },
        ],
      },
    ],
    ...overrides,
  };
}

describe("defaultScene", () => {
  it("lines up eleven a side in their own halves with the ball on the centre spot", () => {
    const { tokens } = defaultScene();
    const home = tokens.filter((t) => t.kind === "player" && t.team === "home");
    const away = tokens.filter((t) => t.kind === "player" && t.team === "away");
    expect(home).toHaveLength(11);
    expect(away).toHaveLength(11);
    expect(home.every((t) => t.x < 45.7)).toBe(true);
    expect(away.every((t) => t.x > 45.7)).toBe(true);
    expect(tokens.filter((t) => t.kind === "ball")).toEqual([
      { id: "b1", kind: "ball", x: 45.7, y: 27.5 },
    ]);
  });

  it("is itself a valid scene", () => {
    expect(parseScene(defaultScene())).toEqual(defaultScene());
  });
});

describe("emptyScene", () => {
  it("holds only the ball on the centre spot and is a valid scene", () => {
    const scene = emptyScene();
    expect(scene.tokens).toEqual([
      { id: "b1", kind: "ball", x: 45.7, y: 27.5 },
    ]);
    expect(scene.lines).toEqual([]);
    expect(scene.steps).toEqual([]);
    expect(parseScene(scene)).toEqual(scene);
  });
});

describe("parseScene", () => {
  it("accepts a valid scene, with a curve's control point off the board", () => {
    expect(parseScene(scene())).toEqual(scene());
  });

  it("rounds coordinates to the centimetre and lower-cases roster ids", () => {
    const parsed = parseScene(
      scene({
        tokens: [
          {
            id: "p1",
            kind: "player",
            team: "away",
            label: " TW ",
            playerId: PLAYER_ID.toUpperCase(),
            x: 1.23456,
            y: 2.0049,
          },
        ],
        lines: [],
        steps: [],
      }),
    );
    expect(parsed?.tokens[0]).toEqual({
      id: "p1",
      kind: "player",
      team: "away",
      label: "TW",
      playerId: PLAYER_ID,
      x: 1.23,
      y: 2,
    });
  });

  const ball = (over = {}) => ({ id: "b1", kind: "ball", x: 0, y: 0, ...over });
  const player = (over = {}) => ({
    id: "p1",
    kind: "player",
    team: "home",
    label: "1",
    playerId: null,
    x: 0,
    y: 0,
    ...over,
  });
  const line = (over = {}) => ({
    id: "l1",
    tool: "line",
    color: "red",
    width: "thin",
    style: "solid",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    step: 0,
    ...over,
  });
  const step = (over = {}) => ({ duration: 1, moves: [], ...over });
  const move = (over = {}) => ({ token: "p1", x: 5, y: 5, via: null, ...over });
  const tooMany = Array.from({ length: MAX_TOKENS + 1 }, (_, i) =>
    ball({ id: `b${i}` }),
  );

  it.each([
    ["an unknown version", { version: 3 }],
    ["steps that are not a list", { steps: {} }],
    [
      "too many steps",
      { steps: Array.from({ length: MAX_STEPS + 1 }, () => step()) },
    ],
    ["a step shorter than half a second", { steps: [step({ duration: 0.4 })] }],
    ["a step longer than ten seconds", { steps: [step({ duration: 10.5 })] }],
    ["a duration that is not a number", { steps: [step({ duration: "2" })] }],
    [
      "a move of a token the scene lacks",
      { steps: [step({ moves: [move({ token: "p9" })] })] },
    ],
    [
      "a token moving twice in one step",
      { steps: [step({ moves: [move(), move({ x: 6 })] })] },
    ],
    ["a move off the board", { steps: [step({ moves: [move({ x: 95 })] })] }],
    [
      "a bend off the board",
      { steps: [step({ moves: [move({ via: { x: 5, y: 60 } })] })] },
    ],
    [
      "a move without a via",
      { steps: [step({ moves: [{ token: "p1", x: 5, y: 5 }] })] },
    ],
    ["a line on a step the scene lacks", { lines: [line({ step: 2 })] }],
    ["a line without a step", { lines: [line({ step: undefined })] }],
    ["a fractional line step", { lines: [line({ step: 0.5 })] }],
    ["tokens that are not a list", { tokens: {} }],
    ["too many tokens", { tokens: tooMany }],
    ["two balls", { tokens: [ball(), ball({ id: "b2" })] }],
    ["a duplicate id", { tokens: [ball({ id: "l1" })] }],
    ["a token off the board", { tokens: [ball({ x: 95 })] }],
    ["a non-finite coordinate", { tokens: [ball({ x: Number.NaN })] }],
    ["a malformed id", { tokens: [ball({ id: "<b1>" })] }],
    ["an unknown team", { tokens: [player({ team: "guests" })] }],
    ["a label over four characters", { tokens: [player({ label: "12345" })] }],
    ["a malformed roster id", { tokens: [player({ playerId: "7" })] }],
    ["an unknown line tool", { lines: [line({ tool: "circle" })] }],
    ["an unknown pen colour", { lines: [line({ color: "green" })] }],
    [
      "a straight line with three points",
      { lines: [line({ points: [ball(), ball(), ball()] })] },
    ],
    [
      "a line end off the board",
      { lines: [line({ points: [ball(), ball({ y: 80 })] })] },
    ],
  ])("rejects %s", (_name, overrides) => {
    expect(parseScene(scene(overrides))).toBeNull();
  });
});

describe("upgrading older scenes", () => {
  it("opens a version 1 scene with its lines shown throughout and no steps", () => {
    // A version 1 document: no steps, and lines without one.
    const v1 = {
      ...scene({ steps: undefined }),
      version: 1,
      lines: scene().lines.map((line) => ({ ...line, step: undefined })),
    };
    const parsed = parseScene(v1);
    expect(parsed?.version).toBe(SCENE_VERSION);
    expect(parsed?.steps).toEqual([]);
    expect(parsed?.lines.map((line) => line.step)).toEqual([0]);
    expect(parsed?.tokens).toEqual(scene().tokens);
  });

  it("still rejects a broken version 1 scene", () => {
    expect(parseScene({ version: 1, tokens: {}, lines: [] })).toBeNull();
  });
});

describe("parseSceneJson", () => {
  it("parses a submitted scene", () => {
    expect(parseSceneJson(JSON.stringify(scene()))).toEqual(scene());
  });

  it("rejects text that is not JSON, not a string, or too long", () => {
    expect(parseSceneJson("{nope")).toBeNull();
    expect(parseSceneJson(null)).toBeNull();
    expect(parseSceneJson(" ".repeat(MAX_SCENE_JSON_LENGTH + 1))).toBeNull();
  });
});

describe("nextId", () => {
  it("counts on from the highest id with the prefix", () => {
    const parsed = parseScene(scene());
    if (!parsed) throw new Error("fixture must parse");
    expect(nextId(parsed, "p")).toBe("p2");
    expect(nextId(parsed, "l")).toBe("l2");
    expect(nextId(defaultScene(), "p")).toBe("p23");
  });
});
