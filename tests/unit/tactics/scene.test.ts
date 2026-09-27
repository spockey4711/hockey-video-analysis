import { describe, expect, it } from "vitest";

import {
  defaultScene,
  emptyScene,
  isPlayTool,
  PLAY_TOOL_STYLE,
  PLAY_TOOLS,
  playToolsIn,
  MAX_POLYGON_POINTS,
  MAX_SCENE_JSON_LENGTH,
  MAX_SHAPES,
  MAX_STEPS,
  MAX_TOKENS,
  newScene,
  nextId,
  parseScene,
  parseSceneJson,
  SCENE_VERSION,
  spawnPoint,
} from "@/features/tactics/scene";

const PLAYER_ID = "33333333-3333-4333-8333-333333333333";

function scene(overrides: Record<string, unknown> = {}) {
  return {
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
    shapes: [],
    startCaption: "",
    steps: [
      {
        duration: 2,
        hold: 0,
        caption: "",
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

describe("newScene", () => {
  it("starts the whole pitch with the default lineup", () => {
    expect(newScene("full")).toEqual(defaultScene());
  });

  it("starts the short corner with only the ball in the quarter", () => {
    const corner = newScene("corner");
    expect(corner.view).toBe("corner");
    expect(corner.tokens).toEqual([
      { id: "b1", kind: "ball", x: 10.45, y: 27.5 },
    ]);
    expect(parseScene(corner)).toEqual(corner);
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
            position: " TW ",
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
      position: "TW",
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
    position: "",
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
  const step = (over = {}) => ({
    duration: 1,
    hold: 0,
    caption: "",
    moves: [],
    ...over,
  });
  const move = (over = {}) => ({ token: "p1", x: 5, y: 5, via: null, ...over });
  const tooMany = Array.from({ length: MAX_TOKENS + 1 }, (_, i) =>
    ball({ id: `b${i}` }),
  );

  it.each([
    ["an unknown version", { version: SCENE_VERSION + 1 }],
    ["a side of the pitch as the view", { view: "corner-left" }],
    ["an unknown view", { view: "half" }],
    ["a scene without a view", { view: undefined }],
    ["steps that are not a list", { steps: {} }],
    [
      "too many steps",
      { steps: Array.from({ length: MAX_STEPS + 1 }, () => step()) },
    ],
    ["a step shorter than half a second", { steps: [step({ duration: 0.4 })] }],
    ["a step longer than ten seconds", { steps: [step({ duration: 10.5 })] }],
    ["a duration that is not a number", { steps: [step({ duration: "2" })] }],
    ["a negative hold", { steps: [step({ hold: -1 })] }],
    ["a hold longer than ten seconds", { steps: [step({ hold: 10.5 })] }],
    ["a step without a hold", { steps: [step({ hold: undefined })] }],
    ["a caption that is not text", { steps: [step({ caption: 7 })] }],
    ["a step caption too long", { steps: [step({ caption: "x".repeat(81) })] }],
    ["a start caption too long", { startCaption: "x".repeat(81) }],
    ["a scene without a start caption", { startCaption: undefined }],
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
    [
      "a position code over three characters",
      { tokens: [player({ position: "LIBE" })] },
    ],
    [
      "a player without a position",
      { tokens: [player({ position: undefined })] },
    ],
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
    ["a curve with only two points", { lines: [line({ tool: "curve" })] }],
    ["a dotted pass", { lines: [line({ tool: "pass", style: "dotted" })] }],
    ["a solid run", { lines: [line({ tool: "run", style: "solid" })] }],
    [
      "a play line with four points",
      {
        lines: [
          line({ tool: "dribble", points: [ball(), ball(), ball(), ball()] }),
        ],
      },
    ],
    [
      "a bent play line bending beyond the control margin",
      {
        lines: [
          line({
            tool: "block",
            points: [ball(), ball({ y: 200 }), ball({ x: 5 })],
          }),
        ],
      },
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
    expect(parsed?.view).toBe("full");
    expect(parsed?.steps).toEqual([]);
    expect(parsed?.lines.map((line) => line.step)).toEqual([0]);
    expect(parsed?.tokens).toEqual(scene().tokens);
  });

  it("opens a version 2 scene on the whole pitch, everything else as it was", () => {
    // A version 2 document: steps, but no view.
    const v2 = { ...scene({ view: undefined }), version: 2 };
    expect(parseScene(v2)).toEqual(scene());
  });

  it("opens a version 2 scene on the whole pitch whatever view it carries", () => {
    expect(parseScene({ ...scene(), version: 2, view: "half" })).toEqual(
      scene(),
    );
  });

  it("keeps a version 3 scene on the whole pitch as it was", () => {
    expect(parseScene({ ...scene(), version: 3 })).toEqual(scene());
  });

  it("opens a version 3 left short corner as the short corner, nothing moved", () => {
    expect(parseScene({ ...scene(), version: 3, view: "corner-left" })).toEqual(
      scene({ view: "corner" }),
    );
  });

  it("turns a version 3 right short corner end to end onto the one short corner", () => {
    // Every point of `scene()` mirrored through the centre spot: the same play
    // at the right goal, where the coach set it up.
    const turn = (p: { x: number; y: number }) => ({
      x: 91.4 - p.x,
      y: 55 - p.y,
    });
    const base = scene();
    const right = {
      ...base,
      version: 3,
      view: "corner-right",
      tokens: base.tokens.map((token) => ({ ...token, ...turn(token) })),
      lines: base.lines.map((line) => ({
        ...line,
        points: line.points.map(turn),
      })),
      steps: base.steps.map((step) => ({
        ...step,
        moves: step.moves.map((move) => ({
          ...move,
          ...turn(move),
          via: move.via && turn(move.via),
        })),
      })),
    };
    expect(parseScene(right)).toEqual(scene({ view: "corner" }));
  });

  it("rejects a version 3 scene with an unknown view", () => {
    expect(parseScene({ ...scene(), version: 3, view: "half" })).toBeNull();
  });

  it("keeps a version 4 scene's lines exactly as they were", () => {
    const v4 = { ...scene(), version: 4 };
    expect(parseScene(v4)).toEqual(scene());
  });

  it("opens a version 5 scene with no zones or texts, everything else as it was", () => {
    const v5: Record<string, unknown> = { ...scene(), version: 5 };
    delete v5.shapes;
    expect(parseScene(v5)).toEqual(scene());
  });

  it("opens a version 6 scene with its players and no position codes", () => {
    const base = scene();
    const v6 = {
      ...base,
      version: 6,
      tokens: base.tokens.map((token) => {
        if (token.kind !== "player") return token;
        const rest: Record<string, unknown> = { ...token };
        delete rest.position;
        return rest;
      }),
    };
    expect(parseScene(v6)).toEqual(scene());
  });

  it("opens a version 7 scene with its steps back to back and no captions", () => {
    const base = scene();
    const v7: Record<string, unknown> = {
      ...base,
      version: 7,
      steps: base.steps.map((step) => ({
        duration: step.duration,
        moves: step.moves,
      })),
    };
    delete v7.startCaption;
    expect(parseScene(v7)).toEqual(scene());
  });

  it("keeps the captions and holds a scene sets", () => {
    const base = scene();
    const captioned = {
      ...base,
      startCaption: "Aufbau über links",
      steps: base.steps.map((step) => ({
        ...step,
        hold: 1.5,
        caption: "Pass in die Tiefe",
      })),
    };
    expect(parseScene(captioned)).toEqual(captioned);
  });

  it("keeps a caption on one line, trimmed, and a hold to the hundredth", () => {
    const base = scene();
    const parsed = parseScene({
      ...base,
      startCaption: "  Start  ",
      steps: base.steps.map((step) => ({
        ...step,
        hold: 1.234,
        caption: " Pass\n in   die Tiefe ",
      })),
    });
    expect(parsed?.startCaption).toBe("Start");
    expect(parsed?.steps[0]?.caption).toBe("Pass in die Tiefe");
    expect(parsed?.steps[0]?.hold).toBe(1.23);
  });

  it("keeps a position code the scene sets", () => {
    const base = scene();
    const withCode = {
      ...base,
      tokens: base.tokens.map((token) =>
        token.kind === "player" ? { ...token, position: "LV" } : token,
      ),
    };
    expect(parseScene(withCode)).toEqual(withCode);
  });

  it("still rejects a broken version 1 scene", () => {
    expect(parseScene({ version: 1, tokens: {}, lines: [] })).toBeNull();
  });
});

describe("play lines", () => {
  const playLine = (over: Record<string, unknown>) => ({
    id: "l2",
    color: "white",
    width: "medium",
    style: "solid",
    points: [
      { x: 10, y: 20 },
      { x: 30, y: 20 },
    ],
    step: 0,
    ...over,
  });

  it("accepts each play tool, straight or bent, in its own style", () => {
    const lines = [
      playLine({ id: "l2", tool: "run", style: "dotted" }),
      playLine({ id: "l3", tool: "pass" }),
      playLine({
        id: "l4",
        tool: "dribble",
        points: [
          { x: 10, y: 20 },
          { x: 20, y: -40 },
          { x: 30, y: 20 },
        ],
      }),
      playLine({ id: "l5", tool: "block" }),
    ];
    const parsed = parseScene(scene({ lines }));
    expect(parsed?.lines).toEqual(lines);
  });

  it("lists the play tools a scene's lines use, in the legend's order, once each", () => {
    const lines = [
      playLine({ id: "l2", tool: "block" }),
      playLine({ id: "l3", tool: "arrow" }),
      playLine({ id: "l4", tool: "run", style: "dotted" }),
      playLine({ id: "l5", tool: "block" }),
    ];
    const parsed = parseScene(scene({ lines }));
    expect(parsed && playToolsIn(parsed.lines)).toEqual(["run", "block"]);
    expect(playToolsIn(defaultScene().lines)).toEqual([]);
  });

  it("gives every play tool a fixed style and nothing else one", () => {
    expect(PLAY_TOOLS.map((tool) => PLAY_TOOL_STYLE[tool])).toEqual([
      "dotted",
      "solid",
      "solid",
      "solid",
    ]);
    expect(isPlayTool("arrow")).toBe(false);
    expect(isPlayTool("dribble")).toBe(true);
  });
});

describe("views", () => {
  it("keeps a short-corner view and every position, even outside the quarter", () => {
    // The ball on the centre spot lies outside the left quarter: kept, not moved.
    const corner = scene({ view: "corner" });
    expect(parseScene(corner)).toEqual(corner);
  });

  it("spawns new tokens inside the short-corner quarter on show", () => {
    expect(spawnPoint("ball", "corner")).toEqual({ x: 10.45, y: 27.5 });
    expect(spawnPoint("home", "corner")).toEqual({ x: 10.45, y: 23.5 });
    expect(spawnPoint("away", "corner")).toEqual({ x: 10.45, y: 31.5 });
    expect(spawnPoint("home")).toEqual({ x: 22.85, y: 27.5 });
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

describe("zones and texts", () => {
  /** Points from coordinate pairs: `pts(1, 2, 3, 4)` is (1,2) and (3,4). */
  const pts = (...xy: number[]) =>
    xy.flatMap((x, i) => (i % 2 === 0 ? [{ x, y: xy[i + 1] }] : []));
  const zone = (over: Record<string, unknown> = {}) => ({
    id: "z1",
    kind: "rect",
    color: "red",
    fill: "fill",
    points: pts(10, 10, 20, 18),
    step: 0,
    ...over,
  });
  const text = (over: Record<string, unknown> = {}) => ({
    id: "t1",
    kind: "text",
    color: "white",
    text: "Pressing!",
    bubble: false,
    x: 30,
    y: 12,
    step: 1,
    ...over,
  });
  const triangle = pts(40, 10, 50, 20, 35, 25);

  it("accepts a box, an oval and a polygon, tinted or hatched, and texts", () => {
    const shapes = [
      zone(),
      zone({ id: "z2", kind: "ellipse", fill: "hatch", color: "blue" }),
      zone({ id: "z3", kind: "polygon", points: triangle, step: 1 }),
      text(),
      text({ id: "t2", bubble: true, color: "yellow", step: 0 }),
    ];
    expect(parseScene(scene({ shapes }))?.shapes).toEqual(shapes);
  });

  it("rounds to the centimetre and keeps a text on one line, trimmed", () => {
    const parsed = parseScene(
      scene({
        shapes: [
          zone({ points: pts(1.234, 2.345, 5.678, 9.991) }),
          text({ text: "  Raum\n  eng   machen ", x: 3.14159, y: 2.71828 }),
        ],
      }),
    );
    expect(parsed?.shapes).toMatchObject([
      { points: pts(1.23, 2.35, 5.68, 9.99) },
      { text: "Raum eng machen", x: 3.14, y: 2.72 },
    ]);
    if (!parsed) throw new Error("fixture must parse");
    expect(nextId(parsed, "z")).toBe("z2");
    expect(nextId(parsed, "t")).toBe("t2");
  });

  it.each([
    ["an unknown shape", zone({ kind: "star" })],
    ["an unknown paint", zone({ fill: "dots" })],
    ["an unknown pen colour", zone({ color: "green" })],
    ["a box with three corners", zone({ points: triangle })],
    ["a box with no height", zone({ points: pts(10, 10, 20, 10) })],
    [
      "a polygon with two corners",
      zone({ kind: "polygon", points: pts(1, 1, 5, 5) }),
    ],
    [
      "a polygon with too many corners",
      zone({
        kind: "polygon",
        points: pts(
          ...Array.from(
            { length: (MAX_POLYGON_POINTS + 1) * 2 },
            (_, i) => 10 + (i % 7),
          ),
        ),
      }),
    ],
    ["a corner off the board", zone({ points: pts(10, 10, 20, 70) })],
    ["a shape on a step the scene lacks", zone({ step: 2 })],
    ["a shape without a step", text({ step: undefined })],
    ["an empty text", text({ text: "   " })],
    ["a text over 40 characters", text({ text: "x".repeat(41) })],
    ["a text that is not a string", text({ text: 7 })],
    ["a bubble that is not yes or no", text({ bubble: "yes" })],
    ["a text off the board", text({ x: -10 })],
    ["a shape with a line's id", text({ id: "l1" })],
  ])("rejects %s", (_name, shape) => {
    expect(parseScene(scene({ shapes: [shape] }))).toBeNull();
  });

  it.each([
    ["shapes that are not a list", {}],
    ["a scene without shapes", undefined],
    [
      "too many shapes",
      Array.from({ length: MAX_SHAPES + 1 }, (_, i) =>
        zone({ id: `z${i + 1}` }),
      ),
    ],
  ])("rejects %s", (_name, shapes) => {
    expect(parseScene(scene({ shapes }))).toBeNull();
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
