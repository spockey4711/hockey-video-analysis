/**
 * The Drive import end to end on a fake Drive tree on local disk: real folder
 * scan, real ffprobe, real proxy encode with ffmpeg. Only the database is a
 * fake. CI installs ffmpeg; a machine without it skips this file.
 */
import { execFile, execFileSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createImporter,
  createProxyEncoder,
  encodeProxy,
  probeMedia,
  PROXY_DURATION_TOLERANCE_S,
  scanSourceRoot,
  type ImportedSource,
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
    const rows = new Map<string, string>([["25／26-DTV-BGL", "skipped"]]);
    const registered: {
      folderPath: string;
      playedOn: string | null;
      sources: readonly ImportedSource[];
    }[] = [];
    const repository: IngestRepository = {
      recordedFolders: async () => new Set(rows.keys()),
      recordSkipped: async () => {},
      recordRejected: async (folderPath, reason) => {
        rows.set(folderPath, `rejected: ${reason}`);
      },
      registerGame: async (input) => {
        rows.set(input.folderPath, "imported");
        registered.push(input);
        return { gameId: "game-1" };
      },
    };
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
