/**
 * The Drive import end to end on a fake Drive tree on local disk: real folder
 * scan, real ffprobe, real proxy encode with ffmpeg. Only the database is a
 * fake. CI installs ffmpeg; a machine without it skips this file.
 */
import { execFile, execFileSync } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFakeIngestDb } from "./fake-ingest-db";

import {
  createImporter,
  createProxyEncoder,
  encodeProxy,
  probeMedia,
  PROXY_DURATION_TOLERANCE_S,
  scanSourceRoot,
  temporaryProxyPath,
  type IngestRepository,
} from "@/features/ingest";

const run = promisify(execFile);

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const ffmpegMissing = !hasFfmpeg();
if (ffmpegMissing && process.env.CI) {
  throw new Error("ffmpeg and ffprobe must be installed in CI");
}

/** A short test-pattern video with a tone, taller than the proxy's 720 lines. */
async function makeVideo(
  file: string,
  seconds: number,
  creationTime?: string,
): Promise<void> {
  await run("ffmpeg", [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `testsrc=size=1280x960:rate=25:duration=${seconds}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${seconds}`,
    ...(creationTime ? ["-metadata", `creation_time=${creationTime}`] : []),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    "-shortest",
    file,
  ]);
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(ffmpegMissing)("Drive import on a fake Drive tree", () => {
  let root: string;
  let sourceRoot: string;
  let proxyRoot: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "drive-import-"));
    sourceRoot = path.join(root, "drive");
    proxyRoot = path.join(root, "proxy");

    const oldGame = path.join(sourceRoot, "25／26-DTV-BGL");
    const newGame = path.join(sourceRoot, "26／27-DTV-HTC");
    await mkdir(oldGame, { recursive: true });
    await mkdir(newGame, { recursive: true });
    await writeFile(path.join(sourceRoot, "Strafenkatalog.pdf"), "%PDF");
    await makeVideo(path.join(oldGame, "halbzeit1.mp4"), 1);
    await makeVideo(
      path.join(newGame, "Viertel2.mp4"),
      2,
      "2026-11-01T15:10:00.000000Z",
    );
    await makeVideo(
      path.join(newGame, "Viertel1.mp4"),
      3,
      "2026-11-01T14:40:00.000000Z",
    );
    await makeVideo(path.join(newGame, "TorHTC.MP4"), 1);
  }, 60_000);

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("skips the old folder, imports the new one and encodes its proxies", async () => {
    const db = createFakeIngestDb({
      "25／26-DTV-BGL": "skipped",
    });
    const silent = { info: () => {}, warn: () => {} };

    const { registered } = db;
    const importer = createImporter({
      repository: db.repository,
      scan: () => scanSourceRoot(sourceRoot),
      probe: (relativePath) => probeMedia(path.join(sourceRoot, relativePath)),
      now: () => new Date("2026-11-02T08:00:00Z"),
      log: silent,
      quietMs: 0,
      probeRetryMs: 1000,
    });

    const summary = await importer.runPass();

    expect(summary.imported).toEqual(["26／27-DTV-HTC"]);
    expect(registered).toHaveLength(1);
    const [game] = registered;
    expect(game.playedOn).toBe("2026-11-01");
    expect(game.sources.map((source) => source.filePath)).toEqual([
      "26／27-DTV-HTC/Viertel1.mp4",
      "26／27-DTV-HTC/Viertel2.mp4",
    ]);
    expect(game.sources[0].durationS).toBeCloseTo(3, 0);
    expect(game.sources[1].durationS).toBeCloseTo(2, 0);
    // Hidden from the coach until its proxies exist.
    expect(db.visibleGames()).toEqual([]);

    const encoder = createProxyEncoder({
      sources: db.proxySources,
      sourceRoot,
      proxyRoot,
      exists,
      encode: (input) => encodeProxy({ ...input, threads: 2 }),
      now: () => new Date(),
      log: silent,
      retryMs: 60_000,
    });

    expect(await encoder.encodeNext()).toBe(true);
    expect(await encoder.encodeNext()).toBe(true);
    expect(db.visibleGames()).toEqual([]);
    expect(await encoder.encodeNext()).toBe(false);
    expect(db.visibleGames()).toEqual(["game-1"]);

    const proxyDir = path.join(proxyRoot, "26／27-DTV-HTC");
    expect((await readdir(proxyDir)).sort()).toEqual([
      "Viertel1.mp4",
      "Viertel2.mp4",
    ]);
    for (const source of game.sources) {
      const proxy = path.join(proxyRoot, source.filePath);
      const { durationS } = await probeMedia(proxy);
      expect(Math.abs(durationS - source.durationS)).toBeLessThanOrEqual(
        PROXY_DURATION_TOLERANCE_S,
      );
      const { stdout } = await run("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=height,codec_name,pix_fmt",
        "-of",
        "csv=p=0",
        proxy,
      ]);
      expect(stdout.trim()).toBe("h264,720,yuv420p");
    }
  }, 60_000);
});

describe.skipIf(ffmpegMissing)("Drive import when an upload stalls", () => {
  const QUIET_MS = 30 * 60 * 1000;
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "drive-stall-"));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  /**
   * A fake Drive root of its own with one game folder, an importer on it past
   * its first run, and a clock the test moves.
   */
  async function drive(name: string) {
    const sourceRoot = path.join(root, name, "drive");
    const proxyRoot = path.join(root, name, "proxy");
    const folder = path.join(sourceRoot, "game");
    await mkdir(folder, { recursive: true });
    const db = createFakeIngestDb({ "older-game": "skipped" });
    const warnings: string[] = [];
    let now = new Date("2026-11-02T08:00:00Z");
    const importer = createImporter({
      repository: db.repository,
      scan: () => scanSourceRoot(sourceRoot),
      probe: (relativePath) => probeMedia(path.join(sourceRoot, relativePath)),
      now: () => now,
      log: { info: () => {}, warn: (message) => warnings.push(message) },
      quietMs: QUIET_MS,
      probeRetryMs: 60_000,
    });
    return {
      sourceRoot,
      proxyRoot,
      db,
      warnings,
      /** A file in the game folder. */
      file: (name: string) => path.join(folder, name),
      /** Run a pass after `ms` without new files. */
      passAfter: (ms: number) => {
        now = new Date(now.getTime() + ms);
        return importer.runPass();
      },
      /** Encode proxies until every one that can be made exists. */
      encodeProxies: async () => {
        const encoder = createProxyEncoder({
          sources: db.proxySources,
          sourceRoot,
          proxyRoot,
          exists,
          encode: (input) => encodeProxy({ ...input, threads: 2 }),
          now: () => new Date(),
          log: { info: () => {}, warn: () => {} },
          retryMs: 60_000,
        });
        while (await encoder.encodeNext()) {
          // one proxy per round
        }
      },
    };
  }

  it("appends a chapter that lands after the import while the game is under review", async () => {
    const { proxyRoot, db, file, passAfter, encodeProxies } =
      await drive("late");
    await makeVideo(file("GX010045.MP4"), 3);
    await makeVideo(file("GX020045.MP4"), 2);

    expect((await passAfter(0)).waiting).toEqual(["game"]);
    expect((await passAfter(QUIET_MS)).imported).toEqual(["game"]);
    expect(db.chapters("game-1")).toHaveLength(2);

    // The third chapter's upload stalled past the quiet period.
    await makeVideo(file("GX030045.MP4"), 1);
    expect((await passAfter(0)).waiting).toEqual(["game"]);
    expect((await passAfter(QUIET_MS)).appended).toEqual(["game"]);

    const sources = db.games.get("game-1")?.sources ?? [];
    expect(sources.map((source) => source.filePath)).toEqual([
      "game/GX010045.MP4",
      "game/GX020045.MP4",
      "game/GX030045.MP4",
    ]);
    expect(sources.map((source) => Math.round(source.durationS))).toEqual([
      3, 2, 1,
    ]);
    expect(db.registered).toHaveLength(1);

    // The encoder works from the game's chapters, so the late one gets a proxy
    // too, and the game is shown once all three have one.
    expect(db.visibleGames()).toEqual([]);
    await encodeProxies();
    expect((await readdir(path.join(proxyRoot, "game"))).sort()).toEqual([
      "GX010045.MP4",
      "GX020045.MP4",
      "GX030045.MP4",
    ]);
    expect(db.visibleGames()).toEqual(["game-1"]);
  }, 60_000);

  it("keeps an accepted game as it is and records the late chapter", async () => {
    const { db, file, passAfter, warnings, encodeProxies } =
      await drive("accepted");
    await makeVideo(file("halbzeit1.mp4"), 2);
    await passAfter(0);
    expect((await passAfter(QUIET_MS)).imported).toEqual(["game"]);
    await encodeProxies();
    db.accept("game-1", "DTV - HTC");

    await makeVideo(file("halbzeit2.mp4"), 1);
    await passAfter(0);
    expect((await passAfter(QUIET_MS)).flagged).toEqual(["game"]);
    await passAfter(QUIET_MS);

    expect(db.chapters("game-1")).toEqual(["game/halbzeit1.mp4"]);
    expect(db.rows.get("game")?.detail).toBe(
      "new part(s) after the game was accepted, not added: halbzeit2.mp4",
    );
    expect(warnings).toHaveLength(1);
  }, 60_000);

  it("imports an upload that finished out of order once the gap closes", async () => {
    const { db, file, passAfter } = await drive("gap");
    await makeVideo(file("Viertel2.mp4"), 2);
    await passAfter(0);
    expect((await passAfter(QUIET_MS)).rejected).toEqual(["game"]);
    expect(db.rows.get("game")?.detail).toBe("viertel1 is missing");

    await makeVideo(file("Viertel1.mp4"), 3);
    expect((await passAfter(0)).waiting).toEqual(["game"]);
    expect((await passAfter(QUIET_MS)).imported).toEqual(["game"]);

    expect(db.rows.get("game")?.status).toBe("imported");
    const sources = db.games.get("game-1")?.sources ?? [];
    expect(sources.map((source) => source.filePath)).toEqual([
      "game/Viertel1.mp4",
      "game/Viertel2.mp4",
    ]);
    expect(sources.map((source) => Math.round(source.durationS))).toEqual([
      3, 2,
    ]);
  }, 60_000);

  it("never registers a truncated part and imports the full file once it lands", async () => {
    const { db, file, passAfter, warnings } = await drive("truncated");
    const complete = path.join(root, "truncated", "halbzeit1.mp4");
    await makeVideo(complete, 3);
    // Only the first half of the file: the index at its end is missing.
    const bytes = await readFile(complete);
    await writeFile(file("halbzeit1.mp4"), bytes.subarray(0, bytes.length / 2));

    await passAfter(0);
    const summary = await passAfter(QUIET_MS);
    expect(summary.imported).toEqual([]);
    expect(summary.waiting).toEqual(["game"]);
    expect(db.rows.has("game")).toBe(false);
    expect(db.registered).toEqual([]);
    expect(warnings[0]).toMatch(/^could not probe "game" \(attempt 1/);

    await copyFile(complete, file("halbzeit1.mp4"));
    expect((await passAfter(0)).waiting).toEqual(["game"]);
    expect((await passAfter(QUIET_MS)).imported).toEqual(["game"]);
    expect(db.registered[0].sources[0].durationS).toBeCloseTo(3, 0);
  }, 60_000);
});

describe.skipIf(ffmpegMissing)(
  "Drive import never imports a folder twice",
  () => {
    const QUIET_MS = 30 * 60 * 1000;
    let root: string;

    beforeAll(async () => {
      root = await mkdtemp(path.join(tmpdir(), "drive-dupes-"));
    });

    afterAll(async () => {
      await rm(root, { recursive: true, force: true });
    });

    /**
     * A fake Drive root of its own with the folder `game` holding one half, a
     * database past the importer's first run, and a clock the test moves.
     */
    async function drive(name: string) {
      const sourceRoot = path.join(root, name);
      await mkdir(path.join(sourceRoot, "game"), { recursive: true });
      await makeVideo(path.join(sourceRoot, "game", "halbzeit1.mp4"), 1);
      const db = createFakeIngestDb({ "older-game": "skipped" });
      const warnings: string[] = [];
      const infos: string[] = [];
      let now = new Date("2026-11-02T08:00:00Z");

      /** A fresh importer process on the Drive root and the database. */
      const start = (repository: IngestRepository = db.repository) =>
        createImporter({
          repository,
          scan: () => scanSourceRoot(sourceRoot),
          probe: (relativePath) =>
            probeMedia(path.join(sourceRoot, relativePath)),
          now: () => now,
          log: {
            info: (message) => infos.push(message),
            warn: (message) => warnings.push(message),
          },
          quietMs: QUIET_MS,
          probeRetryMs: 60_000,
        });

      return {
        db,
        warnings,
        infos,
        start,
        /** Rename a game folder on Drive. */
        rename: (from: string, to: string) =>
          rename(path.join(sourceRoot, from), path.join(sourceRoot, to)),
        /** Move the clock on by `ms` without changes on Drive. */
        wait: (ms: number) => {
          now = new Date(now.getTime() + ms);
        },
      };
    }

    /** A drive whose `game` folder one importer has imported as `game-1`. */
    async function imported(name: string) {
      const harness = await drive(name);
      const importer = harness.start();
      await importer.runPass();
      harness.wait(QUIET_MS);
      expect((await importer.runPass()).imported).toEqual(["game"]);
      /** Run a pass after `ms` without changes on Drive. */
      const passAfter = (ms: number) => {
        harness.wait(ms);
        return importer.runPass();
      };
      return { ...harness, importer, passAfter };
    }

    it("does not import the folder again after a worker restart", async () => {
      const { db, start, wait } = await imported("restart");

      const restarted = start();
      expect((await restarted.runPass()).imported).toEqual([]);
      wait(QUIET_MS);
      expect((await restarted.runPass()).imported).toEqual([]);

      expect(db.registered).toHaveLength(1);
    }, 60_000);

    it("imports the folder once when two runs overlap", async () => {
      const { db, start, wait, infos } = await drive("overlap");

      // Both runs read the database before either has registered the folder.
      let reads = 0;
      let bothRead = () => {};
      const read = new Promise<void>((resolve) => (bothRead = resolve));
      const overlapping: IngestRepository = {
        ...db.repository,
        async recordedFolders() {
          const folders = await db.repository.recordedFolders();
          if (++reads === 4) bothRead();
          if (reads > 2) await read;
          return folders;
        },
      };
      const a = start(overlapping);
      const b = start(overlapping);
      await a.runPass();
      await b.runPass();
      wait(QUIET_MS);
      const [first, second] = await Promise.all([a.runPass(), b.runPass()]);

      expect([...first.imported, ...second.imported]).toEqual(["game"]);
      expect(db.registered).toHaveLength(1);
      expect(infos).toContain(
        '"game" was recorded by another importer run meanwhile',
      );
    }, 60_000);

    it("does not import a folder renamed after its import as a second game", async () => {
      const { db, rename, passAfter, warnings } = await imported("rename");

      await rename("game", "26／27 DTV - HTC");
      expect((await passAfter(0)).duplicates).toEqual(["26／27 DTV - HTC"]);
      expect((await passAfter(QUIET_MS)).duplicates).toEqual([
        "26／27 DTV - HTC",
      ]);
      expect(db.registered).toHaveLength(1);
      expect(warnings).toEqual([
        '"26／27 DTV - HTC" holds parts of "game", which is already recorded, ' +
          "so it is not imported (renamed or copied on Drive?)",
      ]);

      // Renamed back, the folder matches its game again.
      await rename("26／27 DTV - HTC", "game");
      const summary = await passAfter(QUIET_MS);
      expect(summary.duplicates).toEqual([]);
      expect(summary.flagged).toEqual([]);
      expect(db.chapters("game-1")).toEqual(["game/halbzeit1.mp4"]);
      expect(db.rows.get("game")?.detail).toBeNull();
    }, 60_000);

    it("keeps a discarded game's folder out, even renamed, until its row is deleted", async () => {
      const { db, rename, passAfter } = await imported("discard");
      db.discard("game-1");

      await passAfter(0);
      expect((await passAfter(QUIET_MS)).imported).toEqual([]);
      expect(db.rows.get("game")).toMatchObject({
        status: "imported",
        gameId: null,
      });

      await rename("game", "game again");
      await passAfter(0);
      expect((await passAfter(QUIET_MS)).duplicates).toEqual(["game again"]);

      // A deliberate re-import: the operator deletes the folder's row.
      db.rows.delete("game");
      await passAfter(0);
      expect((await passAfter(QUIET_MS)).imported).toEqual(["game again"]);
      expect(db.registered.map((game) => game.folderPath)).toEqual([
        "game",
        "game again",
      ]);
    }, 60_000);
  },
);

describe.skipIf(ffmpegMissing)(
  "Drive import when ffprobe or the proxy encode fails",
  () => {
    const QUIET_MS = 30 * 60 * 1000;
    const RETRY_MS = 60_000;
    let root: string;
    let bin: string;

    /** A stand-in for ffprobe or ffmpeg: a shell script in the test's bin dir. */
    async function script(name: string, body: string): Promise<string> {
      const file = path.join(bin, name);
      await writeFile(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
      return file;
    }

    beforeAll(async () => {
      root = await mkdtemp(path.join(tmpdir(), "drive-failures-"));
      bin = path.join(root, "bin");
      await mkdir(bin);
    });

    afterAll(async () => {
      await rm(root, { recursive: true, force: true });
    });

    /**
     * A fake Drive root of its own with the folder `game` holding two halves,
     * a database past the importer's first run, and a clock the test moves.
     * The ffprobe and ffmpeg the worker runs can be swapped for a stand-in.
     */
    async function drive(name: string) {
      const sourceRoot = path.join(root, name, "drive");
      const proxyRoot = path.join(root, name, "proxy");
      await mkdir(path.join(sourceRoot, "game"), { recursive: true });
      await makeVideo(path.join(sourceRoot, "game", "halbzeit1.mp4"), 3);
      await makeVideo(path.join(sourceRoot, "game", "halbzeit2.mp4"), 2);
      const db = createFakeIngestDb({ "older-game": "skipped" });
      const warnings: string[] = [];
      const log = {
        info: () => {},
        warn: (message: string) => warnings.push(message),
      };
      let now = new Date("2026-11-02T08:00:00Z");
      const tools = { ffprobe: "ffprobe", ffmpeg: "ffmpeg", probeTimeoutMs: 0 };

      const importer = createImporter({
        repository: db.repository,
        scan: () => scanSourceRoot(sourceRoot),
        probe: (relativePath) =>
          probeMedia(path.join(sourceRoot, relativePath), {
            ffprobeBinary: tools.ffprobe,
            timeoutMs: tools.probeTimeoutMs || undefined,
          }),
        now: () => now,
        log,
        quietMs: QUIET_MS,
        probeRetryMs: RETRY_MS,
      });

      /** A fresh proxy encoder, as a worker process starts one. */
      const startEncoder = (signal?: AbortSignal) =>
        createProxyEncoder({
          sources: db.proxySources,
          sourceRoot,
          proxyRoot,
          exists,
          encode: (input) =>
            encodeProxy({
              ...input,
              threads: 2,
              ffmpegBinary: tools.ffmpeg,
              signal,
            }),
          now: () => now,
          log,
          retryMs: RETRY_MS,
        });

      /** Run a pass after `ms` without changes on Drive. */
      const passAfter = (ms: number) => {
        now = new Date(now.getTime() + ms);
        return importer.runPass();
      };

      return {
        db,
        warnings,
        tools,
        startEncoder,
        passAfter,
        wait: (ms: number) => {
          now = new Date(now.getTime() + ms);
        },
        /** The files in the game's proxy folder, hidden ones included. */
        proxyFiles: async () =>
          (await exists(path.join(proxyRoot, "game")))
            ? (await readdir(path.join(proxyRoot, "game"))).sort()
            : [],
        proxyPath: (file: string) => path.join(proxyRoot, "game", file),
        /** Import the folder with the real ffprobe: `game-1`, still hidden. */
        importGame: async () => {
          await passAfter(0);
          expect((await passAfter(QUIET_MS)).imported).toEqual(["game"]);
          expect(db.visibleGames()).toEqual([]);
        },
      };
    }

    /** Run the encoder until it has nothing left to do right now. */
    async function drain(encoder: { encodeNext(): Promise<boolean> }) {
      while (await encoder.encodeNext()) {
        // one proxy per round
      }
    }

    it("keeps a folder waiting while ffprobe fails, and imports it once ffprobe reads it", async () => {
      const { db, tools, passAfter, warnings } = await drive("probe-fails");
      tools.ffprobe = await script(
        "failing-ffprobe",
        'echo "Input/output error" >&2; exit 1',
      );

      await passAfter(0);
      expect((await passAfter(QUIET_MS)).waiting).toEqual(["game"]);
      // Not probed again before the retry wait is over.
      expect((await passAfter(RETRY_MS / 2)).waiting).toEqual(["game"]);
      expect(db.rows.has("game")).toBe(false);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(
        /^could not probe "game" \(attempt 1, retrying in 1 min\): ProbeError: ffprobe failed on .*Input\/output error$/,
      );

      tools.ffprobe = "ffprobe";
      expect((await passAfter(RETRY_MS)).imported).toEqual(["game"]);
      expect(db.chapters("game-1")).toEqual([
        "game/halbzeit1.mp4",
        "game/halbzeit2.mp4",
      ]);
    }, 60_000);

    it("stops an ffprobe that never answers instead of holding up the pass", async () => {
      const { db, tools, passAfter, warnings } = await drive("probe-hangs");
      tools.ffprobe = await script("hanging-ffprobe", "exec sleep 30");
      tools.probeTimeoutMs = 1000;

      await passAfter(0);
      const started = Date.now();
      expect((await passAfter(QUIET_MS)).waiting).toEqual(["game"]);
      expect(Date.now() - started).toBeLessThan(10_000);
      expect(db.rows.has("game")).toBe(false);
      expect(warnings[0]).toMatch(/ffprobe gave no answer on .* within 1s$/);

      tools.ffprobe = "ffprobe";
      tools.probeTimeoutMs = 0;
      expect((await passAfter(RETRY_MS)).imported).toEqual(["game"]);
    }, 60_000);

    it("keeps the game hidden while its proxies fail, and shows it once they encode", async () => {
      const {
        db,
        tools,
        startEncoder,
        wait,
        proxyFiles,
        warnings,
        importGame,
      } = await drive("encode-fails");
      await importGame();
      tools.ffmpeg = await script(
        "failing-ffmpeg",
        'echo "Invalid data found when processing input" >&2; exit 1',
      );
      const encoder = startEncoder();

      expect(await encoder.encodeNext()).toBe(true);
      expect(await encoder.encodeNext()).toBe(true);
      // Both chapters are parked now: the encoder idles instead of spinning.
      expect(await encoder.encodeNext()).toBe(false);
      expect(await proxyFiles()).toEqual([]);
      expect(db.visibleGames()).toEqual([]);
      expect(warnings).toEqual([
        expect.stringMatching(
          /^proxy for "game\/halbzeit1.mp4" failed \(attempt 1, retrying in 1 min\): ProxyError: ffmpeg failed on .*Invalid data found when processing input$/,
        ),
        expect.stringMatching(/^proxy for "game\/halbzeit2.mp4" failed/),
      ]);

      tools.ffmpeg = "ffmpeg";
      wait(RETRY_MS);
      await drain(encoder);
      expect(await proxyFiles()).toEqual(["halbzeit1.mp4", "halbzeit2.mp4"]);
      expect(db.visibleGames()).toEqual(["game-1"]);
    }, 60_000);

    it("leaves nothing behind when ffmpeg crashes mid-way", async () => {
      const {
        db,
        tools,
        startEncoder,
        wait,
        proxyFiles,
        warnings,
        importGame,
      } = await drive("encode-crashes");
      await importGame();
      // Writes part of the proxy, then dies the way an out-of-memory kill does.
      tools.ffmpeg = await script(
        "crashing-ffmpeg",
        'for out; do :; done; printf "half a proxy" > "$out"; kill -9 $$',
      );
      const encoder = startEncoder();

      expect(await encoder.encodeNext()).toBe(true);
      expect(await proxyFiles()).toEqual([]);
      expect(db.visibleGames()).toEqual([]);
      expect(warnings[0]).toMatch(
        /^proxy for "game\/halbzeit1.mp4" failed \(attempt 1, .*\): ProxyError: ffmpeg failed on .*: killed by SIGKILL$/,
      );

      tools.ffmpeg = "ffmpeg";
      wait(RETRY_MS);
      await drain(encoder);
      expect(await proxyFiles()).toEqual(["halbzeit1.mp4", "halbzeit2.mp4"]);
      expect(db.visibleGames()).toEqual(["game-1"]);
    }, 60_000);

    it("never moves a proxy into place that is shorter than its original", async () => {
      const { db, tools, startEncoder, proxyFiles, warnings, importGame } =
        await drive("encode-short");
      await importGame();
      // A real encode that stops after one second of the input.
      tools.ffmpeg = await script("short-ffmpeg", 'exec ffmpeg -t 1 "$@"');
      const encoder = startEncoder();

      await drain(encoder);
      expect(await proxyFiles()).toEqual([]);
      expect(db.visibleGames()).toEqual([]);
      expect(warnings).toEqual([
        expect.stringMatching(
          /^proxy for "game\/halbzeit1.mp4" failed .*: ProxyError: proxy of .* lasts 1\.\d{3}s, expected 3\.\d{3}s$/,
        ),
        expect.stringMatching(
          /^proxy for "game\/halbzeit2.mp4" failed .*lasts 1\.\d{3}s, expected 2\.\d{3}s$/,
        ),
      ]);
    }, 60_000);

    it("encodes again after the worker is stopped during an encode", async () => {
      const { db, tools, startEncoder, proxyFiles, proxyPath, importGame } =
        await drive("encode-stopped");
      await importGame();
      tools.ffmpeg = await script(
        "slow-ffmpeg",
        'for out; do :; done; printf "half a proxy" > "$out"; exec sleep 30',
      );
      const controller = new AbortController();
      const round = startEncoder(controller.signal).encodeNext();
      const partial = temporaryProxyPath(proxyPath("halbzeit1.mp4"));
      while (!(await exists(partial))) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      controller.abort(); // SIGTERM to the worker

      await expect(round).rejects.toMatchObject({ name: "AbortError" });
      expect(await proxyFiles()).toEqual([]);
      expect(db.visibleGames()).toEqual([]);

      tools.ffmpeg = "ffmpeg";
      await drain(startEncoder());
      expect(await proxyFiles()).toEqual(["halbzeit1.mp4", "halbzeit2.mp4"]);
      expect(db.visibleGames()).toEqual(["game-1"]);
    }, 60_000);

    it("replaces the half-written proxy a killed worker left behind", async () => {
      const { db, startEncoder, proxyFiles, proxyPath, importGame } =
        await drive("encode-killed");
      await importGame();
      // The worker was killed outright mid-encode: nothing cleaned up.
      const partial = temporaryProxyPath(proxyPath("halbzeit1.mp4"));
      await mkdir(path.dirname(partial), { recursive: true });
      await writeFile(partial, "half a proxy");

      await drain(startEncoder());
      expect(await proxyFiles()).toEqual(["halbzeit1.mp4", "halbzeit2.mp4"]);
      const { durationS } = await probeMedia(proxyPath("halbzeit1.mp4"));
      expect(durationS).toBeCloseTo(3, 0);
      expect(db.visibleGames()).toEqual(["game-1"]);
    }, 60_000);
  },
);
