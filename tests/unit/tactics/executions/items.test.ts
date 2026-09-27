import { describe, expect, it } from "vitest";

import {
  momentSubtitle,
  parsePickerFilter,
  toExecutionPlaylist,
  toExecutionRows,
  toPickerRows,
} from "@/features/tactics/executions/items";
import type { SceneExecution } from "@/features/tactics/executions/queries";

const GAME_ID = "22222222-2222-4222-8222-222222222222";

function execution(overrides: Partial<SceneExecution> = {}): SceneExecution {
  return {
    tagId: "33333333-3333-4333-8333-333333333333",
    tagType: "corner_short",
    extraTypes: [],
    startS: 725,
    endS: 739,
    gameId: GAME_ID,
    gameTitle: "Liga Spieltag 3",
    gameOpponent: "TV Musterstadt",
    playedOn: "2026-05-10",
    clip: {
      id: "44444444-4444-4444-8444-444444444444",
      status: "ready",
      outputPath: "clips/corner.mp4",
      cutStartS: 723,
    },
    outcome: "success",
    frameRate: 50,
    ...overrides,
  };
}

describe("parsePickerFilter", () => {
  it("starts on short corners in every game", () => {
    expect(parsePickerFilter({})).toEqual({
      type: "corner_short",
      gameId: null,
    });
  });

  it("reads a known type, all types and a game id", () => {
    expect(parsePickerFilter({ type: "goal", game: GAME_ID })).toEqual({
      type: "goal",
      gameId: GAME_ID,
    });
    expect(parsePickerFilter({ type: "all" }).type).toBeNull();
  });

  it("falls back on an unknown type and a game that is not an id", () => {
    expect(parsePickerFilter({ type: "penalty", game: "1; drop" })).toEqual({
      type: "corner_short",
      gameId: null,
    });
    expect(parsePickerFilter({ type: ["goal", "all"] }).type).toBe("goal");
  });
});

describe("momentSubtitle", () => {
  it("names the game, opponent, date and game time", () => {
    expect(momentSubtitle(execution())).toBe(
      "Liga Spieltag 3 - gegen TV Musterstadt - 10.05.2026 - 12:05",
    );
  });

  it("leaves out what the game does not have", () => {
    expect(
      momentSubtitle(execution({ gameOpponent: null, playedOn: null })),
    ).toBe("Liga Spieltag 3 - 12:05");
  });
});

describe("toExecutionRows", () => {
  it("labels each execution and keeps its outcome and clip state", () => {
    const [row] = toExecutionRows([execution({ outcome: "open", clip: null })]);
    expect(row).toMatchObject({
      title: "Ecke kurz",
      outcome: "open",
      clipStatus: null,
    });
  });
  it("names every type of a corner that ended in a goal", () => {
    const [row] = toExecutionRows([execution({ extraTypes: ["goal"] })]);
    expect(row?.title).toBe("Ecke kurz + Tor");
  });
});

describe("toPickerRows", () => {
  it("marks the tags already linked", () => {
    const linked = execution();
    const other = execution({
      tagId: "55555555-5555-4555-8555-555555555555",
      clip: null,
    });
    expect(
      toPickerRows([linked, other], new Set([linked.tagId])).map((row) => [
        row.linked,
        row.clipStatus,
      ]),
    ).toEqual([
      [true, "ready"],
      [false, null],
    ]);
  });
});

describe("toExecutionPlaylist", () => {
  it("plays the ready clips in the order given, each on its tag window", () => {
    const first = execution();
    const second = execution({
      tagId: "66666666-6666-4666-8666-666666666666",
      startS: 100,
      endS: 114,
      outcome: "failure",
      clip: {
        id: "77777777-7777-4777-8777-777777777777",
        status: "ready",
        outputPath: "clips/second.mp4",
        cutStartS: null,
      },
    });
    const items = toExecutionPlaylist([first, second], "https://media.test");
    expect(items.map((item) => item.id)).toEqual([
      first.clip?.id,
      second.clip?.id,
    ]);
    expect(items[0]).toMatchObject({
      src: "https://media.test/clips/corner.mp4",
      title: "Ecke kurz - Erfolgreich",
      frameRate: 50,
      // The file starts 2 s before the tag, so the window sits 2 s in.
      plan: { inS: 2, outS: 16 },
    });
    expect(items[1]).toMatchObject({
      title: "Ecke kurz - Nicht erfolgreich",
      plan: { inS: 0, outS: 14 },
    });
  });

  it("skips an execution whose clip is not ready or was never cut", () => {
    const items = toExecutionPlaylist(
      [
        execution({ clip: null }),
        execution({
          clip: {
            id: "88888888-8888-4888-8888-888888888888",
            status: "processing",
            outputPath: null,
            cutStartS: null,
          },
        }),
      ],
      undefined,
    );
    expect(items).toEqual([]);
  });
});
