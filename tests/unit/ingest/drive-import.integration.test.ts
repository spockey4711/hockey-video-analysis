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
    const { repository, registered } = createFakeIngestDb({
      "25／26-DTV-BGL": "skipped",
    });
    const silent = { info: () => {}, warn: () => {} };

    const importer = createImporter({
      repository,
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

    const encoder = createProxyEncoder({
      sources: { listProxySources: async () => game.sources },
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
    expect(await encoder.encodeNext()).toBe(false);

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
    };
  }

  it("appends a chapter that lands after the import while the game is under review", async () => {
    const { sourceRoot, proxyRoot, db, file, passAfter } = await drive("late");
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

    // The encoder works from the game's chapters, so the late one gets a proxy too.
    const encoder = createProxyEncoder({
      sources: { listProxySources: async () => sources },
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
    expect((await readdir(path.join(proxyRoot, "game"))).sort()).toEqual([
      "GX010045.MP4",
      "GX020045.MP4",
      "GX030045.MP4",
    ]);
  }, 60_000);

  it("keeps an accepted game as it is and records the late chapter", async () => {
    const { db, file, passAfter, warnings } = await drive("accepted");
    await makeVideo(file("halbzeit1.mp4"), 2);
    await passAfter(0);
    expect((await passAfter(QUIET_MS)).imported).toEqual(["game"]);
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
