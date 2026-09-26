import { describe, expect, it } from "vitest";

import {
  BUILT_IN_STARTS,
  builtInScene,
  FORMATION_VERSION,
  formationFromScene,
  isBuiltInStart,
  parseFormation,
  parseFormationJson,
  sceneFromFormation,
  teamCounts,
  type TacticsFormation,
} from "@/features/tactics/formation";
import {
  CENTRE,
  GOAL_WIDTH,
  PITCH_VIEWS,
  viewBounds,
} from "@/features/tactics/pitch";
import {
  defaultScene,
  MAX_SCENE_JSON_LENGTH,
  parseScene,
  type PlayerToken,
  type TacticsScene,
} from "@/features/tactics/scene";

const PLAYER_ID = "44444444-4444-4444-8444-444444444444";

function deepDefence(): TacticsFormation {
  return {
    version: FORMATION_VERSION,
    view: "full",
    tokens: [
      {
        id: "p1",
        kind: "player",
        team: "home",
        label: "TW",
        playerId: null,
        x: 3,
        y: 27.5,
      },
      {
        id: "p2",
        kind: "player",
        team: "home",
        label: "LV",
        playerId: null,
        x: 18.25,
        y: 12,
      },
      { id: "b1", kind: "ball", x: 45.7, y: 27.5 },
    ],
  };
}

function players(scene: TacticsScene): PlayerToken[] {
  return scene.tokens.filter(
    (token): token is PlayerToken => token.kind === "player",
  );
}

describe("parseFormation", () => {
  it("accepts a formation and returns a clean copy", () => {
    const formation = deepDefence();
    const parsed = parseFormation(formation);
    expect(parsed).toEqual(formation);
    expect(parsed).not.toBe(formation);
  });

  it("checks and rounds the tokens exactly like a scene's", () => {
    const formation = {
      ...deepDefence(),
      tokens: [{ ...deepDefence().tokens[0], x: 3.004 }],
    };
    expect(parseFormation(formation)?.tokens[0]).toMatchObject({ x: 3 });

    const tooFar = {
      ...deepDefence(),
      tokens: [{ ...deepDefence().tokens[0], x: 200 }],
    };
    const twoBalls = {
      ...deepDefence(),
      tokens: [
        { id: "b1", kind: "ball", x: 1, y: 1 },
        { id: "b2", kind: "ball", x: 2, y: 2 },
      ],
    };
    const sameId = {
      ...deepDefence(),
      tokens: [
        deepDefence().tokens[0],
        { ...deepDefence().tokens[1], id: "p1" },
      ],
    };
    const longLabel = {
      ...deepDefence(),
      tokens: [{ ...deepDefence().tokens[0], label: "Abwehr" }],
    };
    for (const bad of [tooFar, twoBalls, sameId, longLabel]) {
      expect(parseFormation(bad)).toBeNull();
    }
  });

  it.each([
    ["a scene", defaultScene()],
    ["an unknown version", { ...deepDefence(), version: 2 }],
    ["no version", { ...deepDefence(), version: undefined }],
    ["an unknown view", { ...deepDefence(), view: "half" }],
    ["tokens that are not a list", { ...deepDefence(), tokens: {} }],
    ["null", null],
    ["a list", [deepDefence()]],
  ])("rejects %s", (_name, raw) => {
    expect(parseFormation(raw)).toBeNull();
  });

  it("refuses a token linked to a roster player", () => {
    const linked = {
      ...deepDefence(),
      tokens: [{ ...deepDefence().tokens[0], playerId: PLAYER_ID }],
    };
    expect(parseFormation(linked)).toBeNull();
  });

  it("parses JSON text and refuses bad or oversized text", () => {
    expect(parseFormationJson(JSON.stringify(deepDefence()))).toEqual(
      deepDefence(),
    );
    expect(parseFormationJson("{")).toBeNull();
    expect(parseFormationJson(42)).toBeNull();
    expect(
      parseFormationJson(" ".repeat(MAX_SCENE_JSON_LENGTH + 1)),
    ).toBeNull();
  });
});

describe("formationFromScene and sceneFromFormation", () => {
  it("keeps a scene's view and start tokens without lines, steps or roster links", () => {
    const scene: TacticsScene = {
      ...defaultScene(),
      tokens: defaultScene().tokens.map((token) =>
        token.id === "p1" ? { ...token, playerId: PLAYER_ID } : token,
      ),
      lines: [
        {
          id: "l1",
          tool: "arrow",
          color: "red",
          width: "medium",
          style: "solid",
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 20 },
          ],
          step: 1,
        },
      ],
      steps: [
        { duration: 2, moves: [{ token: "p1", x: 30, y: 30, via: null }] },
      ],
    };
    const formation = formationFromScene(scene);

    expect(formation.view).toBe("full");
    expect(formation.tokens).toHaveLength(scene.tokens.length);
    expect(formation.tokens[0]).toMatchObject({
      x: 3,
      y: 27.5,
      playerId: null,
    });
    expect(parseFormation(formation)).toEqual(formation);
  });

  it("starts a scene from a copy with no lines or steps, in both views", () => {
    for (const source of [defaultScene(), builtInScene("corner-defence")]) {
      const formation = formationFromScene(source);
      const scene = sceneFromFormation(formation);

      expect(parseScene(scene)).toEqual(scene);
      expect(scene).toMatchObject({ view: source.view, lines: [], steps: [] });
      expect(scene.tokens).toEqual(formation.tokens);
      expect(scene.tokens).not.toBe(formation.tokens);
      expect(scene.tokens[0]).not.toBe(formation.tokens[0]);
    }
  });

  it("counts the players of each team", () => {
    expect(teamCounts(deepDefence().tokens)).toEqual({ home: 2, away: 0 });
    expect(teamCounts(defaultScene().tokens)).toEqual({ home: 11, away: 11 });
  });
});

describe("built-in starts", () => {
  it("offers each view's starts, the old default first", () => {
    expect(BUILT_IN_STARTS.full[0]).toBe("lineup");
    expect(BUILT_IN_STARTS.corner[0]).toBe("ball");
    expect(isBuiltInStart("corner", "corner-defence")).toBe(true);
    expect(isBuiltInStart("full", "corner-defence")).toBe(false);
    expect(isBuiltInStart("full", "4-4-2")).toBe(false);
  });

  it("builds valid scenes of their view with every token in sight", () => {
    for (const view of PITCH_VIEWS) {
      const bounds = viewBounds(view);
      for (const start of BUILT_IN_STARTS[view]) {
        const scene = builtInScene(start);
        expect(parseScene(scene)).toEqual(scene);
        expect(scene.view).toBe(view);
        for (const token of scene.tokens) {
          expect(token.x).toBeGreaterThanOrEqual(bounds.minX);
          expect(token.x).toBeLessThanOrEqual(bounds.maxX);
          expect(token.y).toBeGreaterThanOrEqual(bounds.minY);
          expect(token.y).toBeLessThanOrEqual(bounds.maxY);
        }
      }
    }
  });

  it("puts five defenders in the goal behind the back-line at a short corner", () => {
    const scene = builtInScene("corner-defence");
    const home = players(scene).filter((token) => token.team === "home");
    const away = players(scene).filter((token) => token.team === "away");

    expect(home).toHaveLength(5);
    expect(home.map((token) => token.label)).toContain("TW");
    for (const token of home) {
      expect(token.x).toBeLessThan(0);
      expect(Math.abs(token.y - CENTRE.y)).toBeLessThan(GOAL_WIDTH / 2);
    }
    expect(away).toHaveLength(6);
    // The injector stands behind the back-line with the ball.
    expect(away.filter((token) => token.x < 0)).toHaveLength(1);
    const ball = scene.tokens.find((token) => token.kind === "ball");
    expect(ball).toMatchObject({ x: 0 });
  });

  it("swaps the teams when the coach's team attacks the corner", () => {
    const defend = players(builtInScene("corner-defence"));
    const attack = players(builtInScene("corner-attack"));
    const at = (tokens: PlayerToken[], team: string) =>
      tokens
        .filter((token) => token.team === team)
        .map(({ x, y, label }) => ({ x, y, label }));

    expect(at(attack, "home")).toEqual(at(defend, "away"));
    expect(at(attack, "away")).toEqual(at(defend, "home"));
  });
});
