import { describe, expect, it } from "vitest";

import {
  buildProxyArgs,
  createProxyEncoder,
  ProxyError,
  resolveInside,
  temporaryProxyPath,
  type ProxySource,
} from "@/features/ingest";

const MINUTE = 60 * 1000;

describe("buildProxyArgs", () => {
  it("encodes 720p H.264 with capped threads, keeping only video and audio", () => {
    const args = buildProxyArgs("/src/g/GX010001.MP4", "/proxy/g/out.mp4", 2);
    expect(args.slice(0, 8)).toEqual([
      "-nostdin",
      "-y",
      "-loglevel",
      "error",
      "-threads",
      "2",
      "-i",
      "/src/g/GX010001.MP4",
    ]);
    expect(args).toEqual(
      expect.arrayContaining(["-map", "0:v:0", "-map", "0:a:0?"]),
    );
    const flag = (name: string) => args[args.indexOf(name) + 1];
    expect(flag("-vf")).toBe("scale=-2:'min(720,ih)'");
    expect(flag("-pix_fmt")).toBe("yuv420p");
    expect(flag("-c:v")).toBe("libx264");
    expect(flag("-movflags")).toBe("+faststart");
    expect(args.filter((arg) => arg === "-threads")).toHaveLength(2);
    expect(args.at(-1)).toBe("/proxy/g/out.mp4");
  });
});

describe("resolveInside", () => {
  it("resolves a relative chapter path under the root", () => {
    expect(resolveInside("/srv/proxy", "26／27-DTV-BWK/Viertel1.mp4")).toBe(
      "/srv/proxy/26／27-DTV-BWK/Viertel1.mp4",
    );
  });

  it.each(["../etc/passwd", "a/../../b.mp4", "/abs/x.mp4", ".", ""])(
    "refuses %j, which leaves the root",
    (relativePath) => {
      expect(resolveInside("/srv/proxy", relativePath)).toBeNull();
    },
  );
});

describe("temporaryProxyPath", () => {
  it("is a hidden file next to the final proxy", () => {
    expect(temporaryProxyPath("/srv/proxy/game/halbzeit1.mp4")).toBe(
      "/srv/proxy/game/.halbzeit1.mp4.partial.mp4",
    );
  });
});

/** An encoder over an in-memory set of existing files. */
function setup(sources: ProxySource[], existing: string[]) {
  const files = new Set(existing);
  const state = { now: new Date("2026-11-01T10:00:00Z") };
  const encoded: string[] = [];
  const failing = new Map<string, Error>();
  const logs: string[] = [];
  const encoder = createProxyEncoder({
    sources: { listProxySources: async () => sources },
    sourceRoot: "/src",
    proxyRoot: "/proxy",
    exists: async (absolutePath) => files.has(absolutePath),
    encode: async ({ sourcePath, proxyPath, expectedDurationS }) => {
      const error = failing.get(sourcePath);
      if (error) throw error;
      encoded.push(`${sourcePath} -> ${proxyPath} (${expectedDurationS}s)`);
      files.add(proxyPath);
    },
    now: () => state.now,
    log: {
      info: (message) => logs.push(`info ${message}`),
      warn: (message) => logs.push(`warn ${message}`),
    },
    retryMs: 30 * MINUTE,
  });
  const advance = (ms: number) => {
    state.now = new Date(state.now.getTime() + ms);
  };
  return { encoder, encoded, failing, logs, advance, files };
}

describe("createProxyEncoder", () => {
  const sources = [
    { filePath: "new/halbzeit1.mp4", durationS: 2100 },
    { filePath: "new/halbzeit2.mp4", durationS: 2050 },
    { filePath: "old/viertel1.mp4", durationS: 900 },
  ];

  it("encodes one missing proxy per round, in list order, then idles", async () => {
    const { encoder, encoded } = setup(sources, [
      "/src/new/halbzeit1.mp4",
      "/src/new/halbzeit2.mp4",
      "/src/old/viertel1.mp4",
      "/proxy/new/halbzeit1.mp4",
    ]);

    expect(await encoder.encodeNext()).toBe(true);
    expect(await encoder.encodeNext()).toBe(true);
    expect(await encoder.encodeNext()).toBe(false);
    expect(encoded).toEqual([
      "/src/new/halbzeit2.mp4 -> /proxy/new/halbzeit2.mp4 (2050s)",
      "/src/old/viertel1.mp4 -> /proxy/old/viertel1.mp4 (900s)",
    ]);
  });

  it("skips chapters whose original is not under the source root, warning once", async () => {
    const { encoder, encoded, logs } = setup(sources, [
      "/src/old/viertel1.mp4",
    ]);

    await encoder.encodeNext();
    await encoder.encodeNext();

    expect(encoded).toEqual([
      "/src/old/viertel1.mp4 -> /proxy/old/viertel1.mp4 (900s)",
    ]);
    expect(
      logs.filter((line) => line.includes("not found under the source root")),
    ).toHaveLength(2);
  });

  it("never touches a path that leaves the media roots", async () => {
    const { encoder, encoded, logs } = setup(
      [{ filePath: "../../etc/passwd", durationS: 1 }],
      [],
    );

    expect(await encoder.encodeNext()).toBe(false);
    expect(encoded).toEqual([]);
    expect(logs[0]).toContain("leaves the media root");
  });

  it("parks a failed chapter, moves on, and retries it later", async () => {
    const { encoder, encoded, failing, advance } = setup(sources.slice(0, 2), [
      "/src/new/halbzeit1.mp4",
      "/src/new/halbzeit2.mp4",
    ]);
    failing.set(
      "/src/new/halbzeit1.mp4",
      new ProxyError("proxy lasts 12.000s, expected 2100.000s"),
    );

    expect(await encoder.encodeNext()).toBe(true); // halbzeit1 fails
    expect(await encoder.encodeNext()).toBe(true); // halbzeit2 encodes
    expect(await encoder.encodeNext()).toBe(false); // halbzeit1 is parked
    failing.clear();
    advance(30 * MINUTE);
    expect(await encoder.encodeNext()).toBe(true);
    expect(encoded).toHaveLength(2);
  });

  it("lets a shutdown through instead of parking the chapter", async () => {
    const { encoder, failing } = setup(sources.slice(0, 1), [
      "/src/new/halbzeit1.mp4",
    ]);
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    failing.set("/src/new/halbzeit1.mp4", abort);

    await expect(encoder.encodeNext()).rejects.toBe(abort);
  });
});
