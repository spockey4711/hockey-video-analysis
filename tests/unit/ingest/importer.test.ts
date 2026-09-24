import { describe, expect, it } from "vitest";

import {
  BASELINE_DETAIL,
  createImporter,
  fingerprintFiles,
  ProbeError,
  type FolderSnapshot,
  type ImportedSource,
  type IngestRepository,
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

interface Registered {
  folderPath: string;
  playedOn: string | null;
  sources: readonly ImportedSource[];
}

function fakeRepository(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  const registered: Registered[] = [];
  const rejected: Record<string, string> = {};
  const skipped: Record<string, string> = {};
  const repository: IngestRepository = {
    recordedFolders: async () => new Set(rows.keys()),
    recordSkipped: async (paths, detail) => {
      for (const path of paths) {
        rows.set(path, "skipped");
        skipped[path] = detail;
      }
    },
    recordRejected: async (path, reason) => {
      rows.set(path, "rejected");
      rejected[path] = reason;
    },
    registerGame: async (input) => {
      rows.set(input.folderPath, "imported");
      registered.push(input);
      return { gameId: `game-${registered.length}` };
    },
  };
  return { repository, rows, registered, rejected, skipped };
}

/** An importer over a mutable folder list and a clock the test advances. */
function setup(options: {
  folders: FolderSnapshot[];
  recorded?: Record<string, string>;
  probes?: Record<string, MediaProbe | Error>;
}) {
  const state = {
    folders: options.folders,
    now: new Date("2026-11-01T10:00:00Z"),
    probed: [] as string[],
  };
  const repo = fakeRepository(options.recorded ?? { "old-game": "skipped" });
  const logs: string[] = [];
  const importer = createImporter({
    repository: repo.repository,
    scan: async () => state.folders,
    probe: async (relativePath) => {
      state.probed.push(relativePath);
      const probe = options.probes?.[relativePath] ?? {
        durationS: 600,
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
    expect(repo.skipped).toEqual({
      "25／26-DTV-BGL": BASELINE_DETAIL,
      "26／27-DTV-BWK": BASELINE_DETAIL,
    });
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
    expect(repo.skipped).toEqual({});
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
          creationTime: "2026-11-01T14:02:11.000000Z",
        },
        "2026-11-01 vs HTC/GX020045.MP4": {
          durationS: 431.25,
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
        playedOn: "2026-11-01",
        sources: [
          { filePath: "2026-11-01 vs HTC/GX010045.MP4", durationS: 1062.5 },
          { filePath: "2026-11-01 vs HTC/GX020045.MP4", durationS: 431.25 },
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
    expect(repo.rejected).toEqual({
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

    probes["game/halbzeit1.mp4"] = { durationS: 2000, creationTime: null };
    advance(9 * MINUTE);
    await importer.runPass();
    expect(repo.registered).toHaveLength(0);
    advance(MINUTE);
    await importer.runPass();
    expect(repo.registered).toHaveLength(1);
  });
});
