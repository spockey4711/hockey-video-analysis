/**
 * The clip worker's check of a clip file the Mac uploaded (Mac plan S5): the
 * pure ffprobe argument, parse and verdict helpers, then the whole check on
 * small files ffmpeg generates here (a test pattern, never real footage). CI
 * installs ffmpeg; a machine without it skips the file-based part.
 */
import { execFile, execFileSync } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildUploadProbeArgs,
  checkClipUpload,
  CLIP_DURATION_TOLERANCE_S,
  ClipUploadError,
  parseUploadProbe,
  uploadProblem,
} from "@/features/clips/cut";

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

describe("the upload probe", () => {
  it("asks ffprobe for the container and the stream types only", () => {
    const args = buildUploadProbeArgs("/staging/a.part");
    expect(args[args.indexOf("-show_entries") + 1]).toBe(
      "format=format_name,duration:stream=codec_type",
    );
    expect(args.at(-1)).toBe("/staging/a.part");
  });

  it("reads the format, the duration and the stream types", () => {
    const stdout = JSON.stringify({
      streams: [{ codec_type: "video" }, { codec_type: "audio" }],
      format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "16.02" },
    });
    expect(parseUploadProbe(stdout)).toEqual({
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      durationS: 16.02,
      streamTypes: ["video", "audio"],
    });
  });

  it("reads a missing duration as none", () => {
    expect(
      parseUploadProbe('{"format":{"format_name":"mp4"}}').durationS,
    ).toBeNull();
    expect(
      parseUploadProbe('{"format":{"format_name":"mp4","duration":"N/A"}}')
        .durationS,
    ).toBeNull();
  });

  it("refuses an answer without a format", () => {
    expect(() => parseUploadProbe("not json")).toThrow(ClipUploadError);
    expect(() => parseUploadProbe('{"streams":[]}')).toThrow(ClipUploadError);
  });
});

describe("uploadProblem", () => {
  const good = {
    formatName: "mov,mp4,m4a,3gp,3g2,mj2",
    durationS: 16,
    streamTypes: ["video", "audio"],
  };

  it("passes an MP4 with video lasting the expected time", () => {
    expect(uploadProblem(good, 16)).toBeNull();
    expect(uploadProblem(good, 16 + CLIP_DURATION_TOLERANCE_S)).toBeNull();
  });

  it("names what is wrong", () => {
    expect(uploadProblem({ ...good, formatName: "matroska,webm" }, 16)).toBe(
      "not an MP4 container (matroska,webm)",
    );
    expect(uploadProblem({ ...good, streamTypes: ["audio"] }, 16)).toBe(
      "no video stream",
    );
    expect(uploadProblem({ ...good, durationS: null }, 16)).toBe("no duration");
    expect(uploadProblem(good, 20)).toBe("lasts 16.000s, expected 20.000s");
  });
});

describe.skipIf(ffmpegMissing)("checkClipUpload on generated files", () => {
  let dir: string;
  let clip: string;
  let audioOnly: string;
  let matroska: string;

  async function generate(file: string, args: string[]): Promise<void> {
    await run("ffmpeg", [
      "-nostdin",
      "-y",
      "-loglevel",
      "error",
      ...args,
      file,
    ]);
  }

  async function size(file: string): Promise<number> {
    return (await stat(file)).size;
  }

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "upload-check-"));
    clip = path.join(dir, "clip.part");
    audioOnly = path.join(dir, "audio.part");
    matroska = path.join(dir, "clip-mkv.part");
    const video = [
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=320x240:rate=25:duration=4",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=4",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-c:a",
      "aac",
      "-shortest",
    ];
    // The staged name carries no extension, so the container is named.
    await generate(clip, [...video, "-f", "mp4"]);
    await generate(matroska, [...video, "-f", "matroska"]);
    await generate(audioOnly, [
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=4",
      "-c:a",
      "aac",
      "-f",
      "mp4",
    ]);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("passes a clip of the expected size and duration", async () => {
    await expect(
      checkClipUpload(clip, { sizeBytes: await size(clip), durationS: 4 }),
    ).resolves.toBeUndefined();
  });

  it("refuses a clip that lasts too long or too short", async () => {
    await expect(
      checkClipUpload(clip, { sizeBytes: await size(clip), durationS: 12 }),
    ).rejects.toThrow(/lasts 4\.\d+s, expected 12\.000s/);
  });

  it("refuses a file of another size before probing it", async () => {
    await expect(
      checkClipUpload(
        clip,
        { sizeBytes: (await size(clip)) + 1, durationS: 4 },
        "/nonexistent/ffprobe",
      ),
    ).rejects.toThrow(/announced/);
  });

  it("refuses a file that does not start like an MP4 before probing it", async () => {
    await expect(
      checkClipUpload(
        matroska,
        { sizeBytes: await size(matroska), durationS: 4 },
        "/nonexistent/ffprobe",
      ),
    ).rejects.toThrow("does not start like an MP4 file");
  });

  it("refuses an MP4 without a video stream", async () => {
    await expect(
      checkClipUpload(audioOnly, {
        sizeBytes: await size(audioOnly),
        durationS: 4,
      }),
    ).rejects.toThrow("no video stream");
  });

  it("refuses a file ffprobe cannot read", async () => {
    const broken = path.join(dir, "broken.part");
    const bytes = new Uint8Array(64);
    bytes.set(new TextEncoder().encode("ftypisom"), 4);
    await writeFile(broken, bytes);
    await expect(
      checkClipUpload(broken, { sizeBytes: 64, durationS: 4 }),
    ).rejects.toThrow(ClipUploadError);
  });
});
