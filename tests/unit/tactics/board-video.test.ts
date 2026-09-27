import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sceneDuration, type SceneFrame } from "@/features/tactics/animation";
import { paintBoard } from "@/features/tactics/board-image";
import {
  BoardVideoFailure,
  boardVideoName,
  renderBoardVideo,
  VIDEO_CODECS,
  VIDEO_FPS,
  VIDEO_LEAD,
  videoEncoderConfig,
  videoSize,
  videoTimes,
  VideoUnsupported,
} from "@/features/tactics/board-video";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";

vi.mock("@/features/tactics/board-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/tactics/board-image")>()),
  paintBoard: vi.fn(async () => {}),
  boardCanvas: vi.fn(() => ({ canvas: {} })),
}));

const SCENE: TacticsScene = {
  version: SCENE_VERSION,
  view: "full",
  tokens: [
    {
      id: "h9",
      kind: "player",
      team: "home",
      label: "9",
      position: "",
      playerId: null,
      x: 40,
      y: 20,
    },
  ],
  lines: [],
  shapes: [],
  startCaption: "Ecke von links",
  steps: [
    {
      duration: 2,
      hold: 2,
      caption: "9 läuft",
      moves: [{ token: "h9", x: 50, y: 20, via: null }],
    },
    {
      duration: 1,
      hold: 0.5,
      caption: "Abschluss",
      moves: [{ token: "h9", x: 60, y: 25, via: null }],
    },
  ],
};

/** A WebCodecs encoder that turns each frame into a two-byte chunk. */
class FakeEncoder {
  static supported = new Set<string>(VIDEO_CODECS);
  static last: FakeEncoder | null = null;
  static isConfigSupported = vi.fn(async (config: VideoEncoderConfig) => ({
    supported: FakeEncoder.supported.has(config.codec),
    config,
  }));
  state: CodecState = "unconfigured";
  encodeQueueSize = 0;
  config: VideoEncoderConfig | null = null;
  readonly frames: { timestamp: number; key: boolean }[] = [];
  /** Fail on this frame, as a broken encoder reports through `error`. */
  failAt = -1;

  constructor(readonly init: VideoEncoderInit) {
    FakeEncoder.last = this;
  }

  configure(config: VideoEncoderConfig): void {
    this.config = config;
    this.state = "configured";
  }

  encode(frame: VideoFrame, options: VideoEncoderEncodeOptions): void {
    const index = this.frames.length;
    if (index === this.failAt) {
      this.init.error(new DOMException("broken", "EncodingError"));
      return;
    }
    const key = options.keyFrame ?? false;
    this.frames.push({ timestamp: frame.timestamp, key });
    const chunk = {
      byteLength: 2,
      timestamp: frame.timestamp,
      type: key ? "key" : "delta",
      copyTo: (into: Uint8Array) => into.set([index & 0xff, 0]),
    } as unknown as EncodedVideoChunk;
    this.init.output(
      chunk,
      index === 0
        ? { decoderConfig: { codec: "avc1", description: new Uint8Array([7]) } }
        : undefined,
    );
  }

  async flush(): Promise<void> {}

  close(): void {
    this.state = "closed";
  }

  addEventListener(): void {}
}

class FakeFrame {
  readonly timestamp: number;
  constructor(_source: unknown, init: VideoFrameInit) {
    this.timestamp = init.timestamp ?? 0;
  }
  close(): void {}
}

const svg = {} as SVGSVGElement;

beforeEach(() => {
  FakeEncoder.supported = new Set(VIDEO_CODECS);
  FakeEncoder.last = null;
  vi.stubGlobal("VideoEncoder", FakeEncoder);
  vi.stubGlobal("VideoFrame", FakeFrame);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(paintBoard).mockClear();
});

describe("videoSize", () => {
  it("makes each shape 1280 pixels wide", () => {
    expect(videoSize("wide")).toEqual({ width: 1280, height: 720 });
    expect(videoSize("standard")).toEqual({ width: 1280, height: 960 });
    expect(videoSize("square")).toEqual({ width: 1280, height: 1280 });
  });
});

describe("videoTimes", () => {
  it("rests on the start, plays with the holds, then rests on the end", () => {
    const times = videoTimes(SCENE);
    // 1 s lead, 5.5 s of animation, and the last hold of 0.5 s topped up by 1 s.
    expect(times).toHaveLength(7.5 * VIDEO_FPS);
    expect(
      times.slice(0, VIDEO_LEAD * VIDEO_FPS + 1).every((t) => t === 0),
    ).toBe(true);
    expect(times[VIDEO_LEAD * VIDEO_FPS + 1]).toBeCloseTo(1 / VIDEO_FPS);
    expect(times.at(-1)).toBe(sceneDuration(SCENE));
    // The time runs forward, never back.
    expect(times.every((t, i) => i === 0 || t >= (times[i - 1] ?? 0))).toBe(
      true,
    );
  });

  it("adds no rest at the end of a last step held long enough", () => {
    const held = {
      ...SCENE,
      steps: SCENE.steps.map((step) => ({ ...step, hold: 3 })),
    };
    expect(videoTimes(held)).toHaveLength((1 + 9) * VIDEO_FPS);
  });
});

describe("boardVideoName", () => {
  it("names the file after the scene", () => {
    expect(boardVideoName("Ecke kurz Variante 2")).toBe(
      "ecke-kurz-variante-2-animation.mp4",
    );
    expect(boardVideoName("")).toBe("taktiktafel-animation.mp4");
  });
});

describe("videoEncoderConfig", () => {
  it("is null without WebCodecs", async () => {
    vi.stubGlobal("VideoEncoder", undefined);
    await expect(videoEncoderConfig(videoSize("wide"))).resolves.toBeNull();
  });

  it("takes the best H.264 profile the browser can encode", async () => {
    await expect(videoEncoderConfig(videoSize("wide"))).resolves.toMatchObject({
      codec: "avc1.640028",
      width: 1280,
      height: 720,
      avc: { format: "avc" },
    });
    FakeEncoder.supported = new Set(["avc1.42e028"]);
    await expect(videoEncoderConfig(videoSize("wide"))).resolves.toMatchObject({
      codec: "avc1.42e028",
    });
  });

  it("skips a setting the browser cannot read", async () => {
    FakeEncoder.isConfigSupported.mockRejectedValueOnce(new TypeError("bad"));
    await expect(videoEncoderConfig(videoSize("wide"))).resolves.toMatchObject({
      codec: "avc1.4d0028",
    });
  });

  it("is null when no profile is supported", async () => {
    FakeEncoder.supported = new Set();
    await expect(videoEncoderConfig(videoSize("wide"))).resolves.toBeNull();
  });
});

function job(overrides: Partial<Parameters<typeof renderBoardVideo>[0]> = {}) {
  const drawn: SceneFrame[] = [];
  const progress: number[] = [];
  return {
    drawn,
    progress,
    options: {
      scene: SCENE,
      preset: "wide" as const,
      draw: (frame: SceneFrame) => {
        drawn.push(frame);
        return svg;
      },
      signal: new AbortController().signal,
      onProgress: (share: number) => progress.push(share),
      ...overrides,
    },
  };
}

describe("renderBoardVideo", () => {
  it("encodes every frame of the animation into an MP4", async () => {
    const { options, progress } = job();
    const file = await renderBoardVideo(options);

    const frames = FakeEncoder.last?.frames ?? [];
    expect(frames).toHaveLength(videoTimes(SCENE).length);
    expect(frames[1]?.timestamp).toBe(Math.round(1e6 / VIDEO_FPS));
    // A key frame every two seconds.
    expect(
      frames.flatMap((frame, index) => (frame.key ? [index] : [])),
    ).toEqual([0, 60, 120, 180]);
    expect(progress.at(-1)).toBe(1);
    expect(FakeEncoder.last?.state).toBe("closed");
    expect(String.fromCharCode(...file.subarray(4, 8))).toBe("ftyp");
  });

  it("draws each step's caption and skips the frames that do not change", async () => {
    const { options, drawn } = job();
    await renderBoardVideo(options);

    const captions = [...new Set(drawn.map((frame) => frame.caption))];
    expect(captions).toEqual(["Ecke von links", "9 läuft", "Abschluss"]);
    // The lead, the holds and the tail are drawn once each, not per frame.
    const moving = (2 + 1) * VIDEO_FPS;
    expect(drawn.length).toBeLessThanOrEqual(moving + 4);
    expect(vi.mocked(paintBoard)).toHaveBeenCalledTimes(drawn.length);
    const held = drawn.filter(
      (frame) => frame.caption === "9 läuft" && frame.tokens[0]?.x === 50,
    );
    expect(held).toHaveLength(1);
  });

  it("says so before drawing when the browser cannot encode", async () => {
    FakeEncoder.supported = new Set();
    const { options, drawn } = job();
    await expect(renderBoardVideo(options)).rejects.toBeInstanceOf(
      VideoUnsupported,
    );
    expect(drawn).toHaveLength(0);
  });

  it("stops when cancelled and closes the encoder", async () => {
    const controller = new AbortController();
    const { options } = job({
      signal: controller.signal,
      draw: () => {
        controller.abort();
        return svg;
      },
    });
    await expect(renderBoardVideo(options)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(FakeEncoder.last?.frames.length).toBeLessThanOrEqual(1);
    expect(FakeEncoder.last?.state).toBe("closed");
  });

  it("fails when the encoder breaks", async () => {
    const { options } = job({
      draw: () => {
        if (FakeEncoder.last) FakeEncoder.last.failAt = 3;
        return svg;
      },
    });
    await expect(renderBoardVideo(options)).rejects.toBeInstanceOf(
      BoardVideoFailure,
    );
  });

  it("fails when a frame cannot be drawn", async () => {
    vi.mocked(paintBoard).mockRejectedValueOnce(new Error("no canvas"));
    const { options } = job();
    await expect(renderBoardVideo(options)).rejects.toBeInstanceOf(
      BoardVideoFailure,
    );
    expect(FakeEncoder.last?.state).toBe("closed");
  });
});
