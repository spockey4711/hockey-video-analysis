import { describe, expect, it } from "vitest";

import { createFakeIngestDb, type FolderStatus } from "./fake-ingest-db";

import {
  BASELINE_DETAIL,
  createImporter,
  fingerprintFiles,
  ProbeError,
  type FolderSnapshot,
  type MediaProbe,
} from "@/features/ingest";

const MINUTE = 60 * 1000;
const QUIET_MS = 30 * MINUTE;

function folder(name: string, files: Record<string, number>): FolderSnapshot {
  const list = Object.entries(files).map(([file, sizeBytes]) => ({
    name: file,
    sizeBytes,
  }));
  return { name, files: list, fingerprint: fingerprintFiles(list) };
}

/** An importer over a mutable folder list and a clock the test advances. */
function setup(options: {
  folders: FolderSnapshot[];
  recorded?: Record<string, FolderStatus>;
  probes?: Record<string, MediaProbe | Error>;
}) {
  const state = {
    folders: options.folders,
    now: new Date("2026-11-01T10:00:00Z"),
    probed: [] as string[],
  };
  const repo = createFakeIngestDb(
    options.recorded ?? { "old-game": "skipped" },
  );
  const logs: string[] = [];
  const importer = createImporter({
    repository: repo.repository,
    scan: async () => state.folders,
    probe: async (relativePath) => {
      state.probed.push(relativePath);
      const probe = options.probes?.[relativePath] ?? {
        durationS: 600,
        frameRate: 50,
        creationTime: null,
      };
      if (probe instanceof Error) throw probe;
      return probe;
    },
    now: () => state.now,
    log: {
      info: (message) => logs.push(`info ${message}`),
      warn: (message) => logs.push(`warn ${message}`),
    },
    quietMs: QUIET_MS,
    probeRetryMs: 5 * MINUTE,
  });
  const advance = (ms: number) => {
    state.now = new Date(state.now.getTime() + ms);
  };
  return { importer, state, repo, logs, advance };
}

describe("createImporter", () => {
  it("records the folders already on Drive as skipped on the very first run", async () => {
    const { importer, repo } = setup({
      recorded: {},
      folders: [
        folder("25／26-DTV-BGL", { "halbzeit1.mp4": 1, "halbzeit2.mp4": 2 }),
        folder("26／27-DTV-BWK", { "Viertel1.mp4": 1 }),
      ],
    });

    const summary = await importer.runPass();

    expect(summary.skipped).toEqual(["25／26-DTV-BGL", "26／27-DTV-BWK"]);
    expect(repo.details("skipped")).toEqual({
      "25／26-DTV-BGL": BASELINE_DETAIL,
      "26／27-DTV-BWK": BASELINE_DETAIL,
    });
    expect(repo.rows.get("25／26-DTV-BGL")?.parts).toBe(
      "halbzeit1.mp4\t1\nhalbzeit2.mp4\t2",
    );
    expect(repo.registered).toEqual([]);
  });

  it("imports a folder that appears after an empty first run", async () => {
    const { importer, state, repo, advance } = setup({
      recorded: {},
      folders: [],
    });
    await importer.runPass();

    state.folders = [folder("game", { "halbzeit1.mp4": 1 })];
    await importer.runPass();
    advance(QUIET_MS);
    const summary = await importer.runPass();

    expect(summary.imported).toEqual(["game"]);
    expect(repo.details("skipped")).toEqual({});
  });

  it("imports a new folder once it has been quiet, parts in play order", async () => {
    const { importer, repo, advance } = setup({
      folders: [
        folder("old-game", { "halbzeit1.mp4": 1 }),
        folder("2026-11-01 vs HTC", {
          "GX020045.MP4": 4000,
          "GX010045.MP4": 4000,
          "TorHTC.MP4": 20,
        }),
      ],
      probes: {
        "2026-11-01 vs HTC/GX010045.MP4": {
          durationS: 1062.5,
          frameRate: 50,
          creationTime: "2026-11-01T14:02:11.000000Z",
        },
        "2026-11-01 vs HTC/GX020045.MP4": {
          durationS: 431.25,
          frameRate: 59.94,
          creationTime: "2026-11-01T14:19:54.000000Z",
        },
      },
    });

    expect((await importer.runPass()).waiting).toEqual(["2026-11-01 vs HTC"]);
    advance(QUIET_MS - 1);
    expect((await importer.runPass()).imported).toEqual([]);
    advance(1);
    const summary = await importer.runPass();

    expect(summary.imported).toEqual(["2026-11-01 vs HTC"]);
    expect(repo.registered).toEqual([
      {
        folderPath: "2026-11-01 vs HTC",
        parts: "GX010045.MP4\t4000\nGX020045.MP4\t4000",
        playedOn: "2026-11-01",
        sources: [
          {
            filePath: "2026-11-01 vs HTC/GX010045.MP4",
            durationS: 1062.5,
            frameRate: 50,
          },
          {
            filePath: "2026-11-01 vs HTC/GX020045.MP4",
            durationS: 431.25,
            frameRate: 59.94,
          },
        ],
      },
    ]);
    expect((await importer.runPass()).imported).toEqual([]);
  });

  it("restarts the quiet period whenever a file arrives", async () => {
    const { importer, state, repo, advance } = setup({
      folders: [folder("game", { "viertel1.mp4": 10 })],
    });

    await importer.runPass();
    advance(QUIET_MS - MINUTE);
    state.folders = [folder("game", { "viertel1.mp4": 10, "viertel2.mp4": 9 })];
    await importer.runPass();
    advance(QUIET_MS - MINUTE);
    expect((await importer.runPass()).imported).toEqual([]);
    advance(MINUTE);
    await importer.runPass();

    expect(repo.registered[0].sources.map((s) => s.filePath)).toEqual([
      "game/viertel1.mp4",
      "game/viertel2.mp4",
    ]);
  });

  it("leaves the date to the coach when no part has a trustworthy one", async () => {
    const { importer, repo, advance } = setup({
      folders: [folder("game", { "halbzeit1.mp4": 1 })],
      probes: {
        "game/halbzeit1.mp4": {
          durationS: 2100,
          frameRate: 50,
          creationTime: "1970-01-01T00:00:00.000000Z",
        },
      },
    });

    await importer.runPass();
    advance(QUIET_MS);
    await importer.runPass();

    expect(repo.registered[0].playedOn).toBeNull();
  });

  it("rejects a folder whose parts cannot be ordered, once", async () => {
    const { importer, repo, state, advance } = setup({
      folders: [folder("mixed", { "halbzeit1.mp4": 1, "viertel1.mp4": 1 })],
    });

    await importer.runPass();
    advance(QUIET_MS);
    const summary = await importer.runPass();

    expect(summary.rejected).toEqual(["mixed"]);
    expect(repo.details("rejected")).toEqual({
      mixed: "the folder mixes halbzeit and viertel files",
    });
    advance(QUIET_MS);
    await importer.runPass();
    expect(state.probed).toEqual([]);
  });

  it("keeps waiting on a folder without parts and logs it once", async () => {
    const { importer, logs, repo, advance } = setup({
      folders: [folder("photos", { "team.jpg": 1 })],
    });

    await importer.runPass();
    advance(QUIET_MS);
    await importer.runPass();
    advance(QUIET_MS);
    const summary = await importer.runPass();

    expect(summary.waiting).toEqual(["photos"]);
    expect(repo.rows.has("photos")).toBe(false);
    expect(logs.filter((line) => line.includes("photos"))).toHaveLength(1);
  });

  it("retries a failed probe with a growing wait instead of giving up", async () => {
    const probes: Record<string, MediaProbe | Error> = {
      "game/halbzeit1.mp4": new ProbeError(
        "Transport endpoint is not connected",
      ),
    };
    const { importer, repo, state, advance } = setup({
      folders: [folder("game", { "halbzeit1.mp4": 1 })],
      probes,
    });

    await importer.runPass();
    advance(QUIET_MS);
    await importer.runPass(); // fails, retry in 5 min
    advance(4 * MINUTE);
    await importer.runPass(); // too early, no probe
    advance(MINUTE);
    await importer.runPass(); // fails again, retry in 10 min
    expect(state.probed).toHaveLength(2);

    probes["game/halbzeit1.mp4"] = {
      durationS: 2000,
      frameRate: 50,
      creationTime: null,
    };
    advance(9 * MINUTE);
    await importer.runPass();
    expect(repo.registered).toHaveLength(0);
    advance(MINUTE);
    await importer.runPass();
    expect(repo.registered).toHaveLength(1);
  });
});

describe("createImporter after an upload stalled", () => {
  /** Import `files` as `game` and return the harness and the new game's id. */
  async function importGame(
    files: Record<string, number>,
    probes: Record<string, MediaProbe | Error> = {},
  ) {
    const harness = setup({ folders: [folder("game", files)], probes });
    await harness.importer.runPass();
    harness.advance(QUIET_MS);
    const summary = await harness.importer.runPass();
    expect(summary.imported).toEqual(["game"]);
    harness.state.probed = [];
    return { ...harness, gameId: "game-1" };
  }

  it("re-checks a folder rejected for a gap once the missing part arrives", async () => {
    const { importer, repo, state, advance } = setup({
      folders: [folder("game", { "viertel1.mp4": 1, "viertel3.mp4": 3 })],
    });
    await importer.runPass();
    advance(QUIET_MS);
    expect((await importer.runPass()).rejected).toEqual(["game"]);
    expect(repo.details("rejected")).toEqual({
      game: "viertel2 is missing",
    });

    state.folders = [
      folder("game", {
        "viertel1.mp4": 1,
        "viertel2.mp4": 2,
        "viertel3.mp4": 3,
      }),
    ];
    expect((await importer.runPass()).waiting).toEqual(["game"]);
    advance(QUIET_MS);
    const summary = await importer.runPass();

    expect(summary.imported).toEqual(["game"]);
    expect(repo.rows.get("game")).toEqual({
      status: "imported",
      detail: null,
      parts: "viertel1.mp4\t1\nviertel2.mp4\t2\nviertel3.mp4\t3",
      gameId: "game-1",
    });
    expect(repo.chapters("game-1")).toEqual([
      "game/viertel1.mp4",
      "game/viertel2.mp4",
      "game/viertel3.mp4",
    ]);
  });

  it("updates the reason of a rejected folder that fails differently now", async () => {
    const { importer, repo, state, advance, logs } = setup({
      folders: [folder("game", { "viertel1.mp4": 1, "viertel4.mp4": 4 })],
    });
    await importer.runPass();
    advance(QUIET_MS);
    await importer.runPass();

    state.folders = [
      folder("game", {
        "viertel1.mp4": 1,
        "viertel2.mp4": 2,
        "viertel4.mp4": 4,
      }),
    ];
    await importer.runPass();
    advance(QUIET_MS);
    await importer.runPass();
    await importer.runPass();

    expect(repo.details("rejected")).toEqual({ game: "viertel3 is missing" });
    expect(state.probed).toEqual([]);
    expect(logs.filter((line) => line.startsWith("warn"))).toHaveLength(2);
  });

  it("appends a late chapter to a game still under review, after a quiet period", async () => {
    const { importer, repo, state, advance, logs, gameId } = await importGame({
      "GX010045.MP4": 4000,
      "GX020045.MP4": 4000,
    });

    state.folders = [
      folder("game", {
        "GX010045.MP4": 4000,
        "GX020045.MP4": 4000,
        "GX030045.MP4": 1200,
      }),
    ];
    expect((await importer.runPass()).waiting).toEqual(["game"]);
    advance(QUIET_MS - 1);
    expect((await importer.runPass()).appended).toEqual([]);
    advance(1);
    const summary = await importer.runPass();

    expect(summary.appended).toEqual(["game"]);
    expect(state.probed).toEqual(["game/GX030045.MP4"]);
    expect(repo.chapters(gameId)).toEqual([
      "game/GX010045.MP4",
      "game/GX020045.MP4",
      "game/GX030045.MP4",
    ]);
    expect(repo.registered).toHaveLength(1);
    expect(logs.at(-1)).toBe(
      'info appended 1 late part(s) of "game" to game game-1: GX030045.MP4',
    );

    advance(QUIET_MS);
    const after = await importer.runPass();
    expect(after.appended).toEqual([]);
    expect(after.waiting).toEqual([]);
  });

  it("leaves an accepted game alone and records the late chapter once", async () => {
    const { importer, repo, state, advance, logs, gameId } = await importGame({
      "halbzeit1.mp4": 1,
    });
    await repo.proxySources.markProxiesReady(gameId, 1);
    repo.accept(gameId, "DTV - HTC");

    state.folders = [
      folder("game", { "halbzeit1.mp4": 1, "halbzeit2.mp4": 2 }),
    ];
    await importer.runPass();
    advance(QUIET_MS);
    const summary = await importer.runPass();
    advance(QUIET_MS);
    await importer.runPass();

    expect(summary.flagged).toEqual(["game"]);
    expect(repo.chapters(gameId)).toEqual(["game/halbzeit1.mp4"]);
    expect(state.probed).toEqual([]);
    const detail =
      "new part(s) after the game was accepted, not added: halbzeit2.mp4";
    expect(repo.rows.get("game")?.detail).toBe(detail);
    expect(logs.filter((line) => line.startsWith("warn"))).toEqual([
      `warn "game" changed after its import, game game-1 left as it is: ${detail}`,
    ]);
  });

  it("does not reorder a game when a part sorts before its chapters", async () => {
    const { importer, repo, state, advance, gameId } = await importGame({
      "viertel2.mp4": 2,
      "viertel1.mp4": 1,
    });
    // A mislabelled file: the game already has quarters 1 and 2.
    state.folders = [
      folder("game", {
        "viertel1.mp4": 1,
        "viertel2.mp4": 2,
        "Viertel 1.mp4": 7,
      }),
    ];
    await importer.runPass();
    advance(QUIET_MS);
    expect((await importer.runPass()).flagged).toEqual(["game"]);
    expect(repo.rows.get("game")?.detail).toBe(
      "the parts can no longer be ordered: viertel1 appears twice " +
        "(Viertel 1.mp4, viertel1.mp4)",
    );

    // The coach removes the stray file: the note goes away, the game is as before.
    state.folders = [folder("game", { "viertel1.mp4": 1, "viertel2.mp4": 2 })];
    await importer.runPass();
    expect(repo.rows.get("game")?.detail).toBeNull();
    expect(repo.chapters(gameId)).toEqual([
      "game/viertel1.mp4",
      "game/viertel2.mp4",
    ]);
  });

  it("appends a late chapter only once it can be probed", async () => {
    const probes: Record<string, MediaProbe | Error> = {
      "game/halbzeit2.mp4": new ProbeError("moov atom not found"),
    };
    const { importer, repo, state, advance, gameId } = await importGame(
      { "halbzeit1.mp4": 1 },
      probes,
    );
    state.folders = [
      folder("game", { "halbzeit1.mp4": 1, "halbzeit2.mp4": 2 }),
    ];
    await importer.runPass();
    advance(QUIET_MS);
    expect((await importer.runPass()).waiting).toEqual(["game"]);
    expect(repo.chapters(gameId)).toEqual(["game/halbzeit1.mp4"]);

    probes["game/halbzeit2.mp4"] = {
      durationS: 2100,
      frameRate: null,
      creationTime: null,
    };
    advance(5 * MINUTE);
    expect((await importer.runPass()).appended).toEqual(["game"]);
    expect(repo.chapters(gameId)).toEqual([
      "game/halbzeit1.mp4",
      "game/halbzeit2.mp4",
    ]);
  });
});

describe("createImporter against duplicate imports", () => {
  const WARNING =
    'warn "game (copy)" holds parts of "game", which is already recorded, ' +
    "so it is not imported (renamed or copied on Drive?)";

  it("does not import a copy of a recorded folder and warns once", async () => {
    const { importer, state, repo, logs, advance } = setup({
      recorded: {},
      folders: [
        folder("game", { "halbzeit1.mp4": 1000, "halbzeit2.mp4": 2000 }),
      ],
    });
    await importer.runPass();

    state.folders = [
      ...state.folders,
      folder("game (copy)", { "halbzeit2.mp4": 2000, "notes.txt": 5 }),
    ];
    expect((await importer.runPass()).duplicates).toEqual(["game (copy)"]);
    advance(QUIET_MS);
    expect((await importer.runPass()).duplicates).toEqual(["game (copy)"]);

    expect(repo.registered).toEqual([]);
    expect(repo.rows.has("game (copy)")).toBe(false);
    expect(logs.filter((line) => line.startsWith("warn"))).toEqual([WARNING]);
  });

  it("imports a folder whose part has a recorded name but another size", async () => {
    const { importer, state, advance } = setup({
      recorded: {},
      folders: [folder("game", { "GX010001.MP4": 4000 })],
    });
    await importer.runPass();

    // The camera's file counter was reset: same name, different recording.
    state.folders = [
      ...state.folders,
      folder("next season", { "GX010001.MP4": 3999 }),
    ];
    await importer.runPass();
    advance(QUIET_MS);

    expect((await importer.runPass()).imported).toEqual(["next season"]);
  });

  it("keeps the parts of a row written before they were kept, then guards them", async () => {
    const { importer, state, repo, logs, advance } = setup({
      recorded: { game: "skipped" },
      folders: [folder("game", { "viertel1.mp4": 1000 })],
    });

    await importer.runPass();
    expect(repo.rows.get("game")?.parts).toBe("viertel1.mp4\t1000");

    state.folders = [folder("game (copy)", { "viertel1.mp4": 1000 })];
    await importer.runPass();
    advance(QUIET_MS);
    expect((await importer.runPass()).duplicates).toEqual(["game (copy)"]);
    expect(repo.registered).toEqual([]);
    expect(logs).toContain(WARNING);
  });
});
