import { afterEach, describe, expect, it } from "vitest";

import {
  boardReducer,
  initialBoardState,
  type BoardAction,
  type BoardState,
} from "@/features/tactics/board-state";
import {
  clipOf,
  parseClip,
  readClip,
  storedClipText,
  writeClip,
  type BoardClip,
} from "@/features/tactics/clipboard";
import {
  defaultScene,
  emptyScene,
  MAX_TOKENS,
  type BoardLine,
  type TacticsScene,
} from "@/features/tactics/scene";

afterEach(() => window.localStorage.clear());

const PASS: BoardLine = {
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
};

const SCENE: TacticsScene = {
  ...defaultScene(),
  tokens: defaultScene().tokens.map((token) =>
    token.id === "p2"
      ? { ...token, playerId: "11111111-1111-4111-8111-111111111111" }
      : token,
  ),
  lines: [PASS],
  steps: [{ duration: 2, moves: [{ token: "p2", x: 20, y: 14, via: null }] }],
};

function run(actions: BoardAction[], state: BoardState) {
  return actions.reduce(boardReducer, state);
}

/** The clip of p2, p3 and the pass, copied on the step on show. */
function copied(step = 0): BoardClip {
  const state = run(
    [
      { type: "goToStep", step },
      { type: "selectMany", ids: ["p2", "p3", "l1"] },
    ],
    initialBoardState(SCENE),
  );
  const clip = clipOf(state);
  if (!clip) throw new Error("nothing copied");
  return clip;
}

describe("clipOf", () => {
  it("copies the selected tokens where they stand on the step, without roster links", () => {
    const clip = copied(1);
    expect(clip.view).toBe("full");
    expect(clip.tokens).toEqual([
      expect.objectContaining({ id: "p2", x: 20, y: 14, playerId: null }),
      expect.objectContaining({ id: "p3", x: 16, y: 27.5 }),
    ]);
    expect(clip.lines).toEqual([PASS]);
  });

  it("copies nothing without a selection", () => {
    expect(clipOf(initialBoardState(SCENE))).toBeNull();
  });
});

describe("parseClip", () => {
  it("takes back a clip it wrote, through storage", () => {
    writeClip(copied());
    expect(storedClipText()).not.toBeNull();
    expect(readClip(storedClipText())).toEqual(copied());
  });

  it("refuses anything that is not a clip the board can paste", () => {
    const clip = copied();
    expect(parseClip(null)).toBeNull();
    expect(parseClip({ ...clip, view: "moon" })).toBeNull();
    expect(parseClip({ ...clip, tokens: [], lines: [] })).toBeNull();
    expect(
      parseClip({
        ...clip,
        tokens: [...clip.tokens, { ...clip.tokens[0], x: 1e6 }],
      }),
    ).toBeNull();
    expect(
      parseClip({
        view: "full",
        tokens: [
          { id: "b1", kind: "ball", x: 1, y: 1 },
          { id: "b2", kind: "ball", x: 2, y: 2 },
        ],
        lines: [],
      }),
    ).toBeNull();
    expect(readClip("{not json")).toBeNull();
    expect(readClip(null)).toBeNull();
  });

  it("puts every line on step 0, whichever step it came from", () => {
    const clip = parseClip({ ...copied(), lines: [{ ...PASS, step: 7 }] });
    expect(clip?.lines[0]?.step).toBe(0);
  });
});

describe("pasting", () => {
  it("pastes beside the originals in the same scene, selecting the copies", () => {
    const start = initialBoardState(SCENE);
    const state = run([{ type: "paste", clip: copied() }], start);
    const added = state.scene.tokens.slice(SCENE.tokens.length);
    expect(added).toEqual([
      expect.objectContaining({ id: "p23", label: "2", x: 18.4, y: 16.4 }),
      expect.objectContaining({ id: "p24", label: "3", x: 18.4, y: 29.9 }),
    ]);
    expect(state.scene.lines[1]).toEqual({
      ...PASS,
      id: "l2",
      points: [
        { x: 18.4, y: 16.4 },
        { x: 18.4, y: 29.9 },
      ],
    });
    expect(state.selectedIds).toEqual(["p23", "p24", "l2"]);
    expect(state.past).toEqual([SCENE]);

    // Pasted again, the next copy moves along once more.
    const again = run([{ type: "paste", clip: copied() }], state);
    expect(again.scene.tokens.at(-1)).toMatchObject({ x: 20.8, y: 32.3 });
  });

  it("pastes in place into another scene of the same view, lines on the step on show", () => {
    const other = run([{ type: "addStep" }], initialBoardState(emptyScene()));
    const state = run([{ type: "paste", clip: copied() }], other);
    expect(state.scene.tokens.slice(1)).toEqual([
      expect.objectContaining({ id: "p1", x: 16, y: 14 }),
      expect.objectContaining({ id: "p2", x: 16, y: 27.5 }),
    ]);
    expect(state.scene.lines).toEqual([{ ...PASS, step: 1 }]);
  });

  it("brings a ball only into a scene without one", () => {
    const withBall: BoardClip = {
      view: "full",
      tokens: [{ id: "b1", kind: "ball", x: 10, y: 10 }],
      lines: [],
    };
    const full = initialBoardState(defaultScene());
    expect(run([{ type: "paste", clip: withBall }], full)).toBe(full);

    const bare = initialBoardState({ ...emptyScene(), tokens: [] });
    const state = run([{ type: "paste", clip: withBall }], bare);
    expect(state.scene.tokens).toEqual([
      { id: "b1", kind: "ball", x: 10, y: 10 },
    ]);
  });

  it("pastes nothing into another view or past the token limit", () => {
    const corner = initialBoardState({ ...emptyScene(), view: "corner" });
    expect(run([{ type: "paste", clip: copied() }], corner)).toBe(corner);

    const crowded = initialBoardState({
      ...emptyScene(),
      tokens: Array.from({ length: MAX_TOKENS - 1 }, (_, index) => ({
        id: `p${index + 1}`,
        kind: "player" as const,
        team: "home" as const,
        label: "",
        playerId: null,
        x: index,
        y: 0,
      })),
    });
    expect(run([{ type: "paste", clip: copied() }], crowded)).toBe(crowded);
  });

  it("keeps a paste at the edge in one piece", () => {
    const clip: BoardClip = {
      view: "full",
      tokens: [
        {
          id: "p1",
          kind: "player",
          team: "away",
          label: "9",
          playerId: null,
          x: 94.4,
          y: 57,
        },
        {
          id: "p2",
          kind: "player",
          team: "away",
          label: "8",
          playerId: null,
          x: 90.4,
          y: 50,
        },
      ],
      lines: [],
    };
    const start = initialBoardState({ ...emptyScene(), tokens: clip.tokens });
    const state = run([{ type: "paste", clip }], start);
    // No room to move along: the copies land on the originals rather than
    // squeezing together at the corner.
    expect(state.scene.tokens.slice(2)).toEqual([
      expect.objectContaining({ x: 94.4, y: 57 }),
      expect.objectContaining({ x: 90.4, y: 50 }),
    ]);
  });
});
