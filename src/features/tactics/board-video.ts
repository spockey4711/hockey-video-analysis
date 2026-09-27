/**
 * The board as a video (M1): the whole animation of a scene as an MP4 for a
 * team chat, made in the browser. Each frame is the engine's `frameAt` at the
 * frame's time, drawn by the picture's own path (`BoardImage`, then
 * `paintBoard` onto a canvas), so the video shows exactly what the board, the
 * link and the picture show, captions included. The browser's WebCodecs
 * encoder turns the frames into H.264 and `muxMp4` packs them into the file.
 *
 * Only the scene reaches a frame, never the coach's private coaching points,
 * which are not part of it.
 */
import { frameAt, sceneDuration, type SceneFrame } from "./animation";
import {
  boardCanvas,
  boardFileStem,
  IMAGE_SIZE,
  paintBoard,
  type FontCache,
  type ImagePreset,
} from "./board-image";
import { muxMp4, type Mp4Sample } from "./mp4";
import type { TacticsScene } from "./scene";

/** Frames per second: smooth runs at a size a team chat takes. */
export const VIDEO_FPS = 30;

/** Seconds the video rests on the start arrangement before the first step. */
export const VIDEO_LEAD = 1;

/**
 * Seconds the video rests on the last step at its end, so the final picture
 * reads before a player stops or loops. A hold the coach gave the last step
 * counts towards it.
 */
export const VIDEO_TAIL = 1.5;

/** The video's pixel size as a share of the picture's: 1280 pixels wide. */
const VIDEO_SCALE = 2 / 3;

/** The bit rate asked of the encoder; the flat board needs little. */
const VIDEO_BITRATE = 2_500_000;

/** Seconds between key frames, where a player can start or seek. */
const KEY_EVERY = 2;

/** The MP4 media timescale: 90 kHz divides every common frame rate. */
const TIMESCALE = 90_000;

/**
 * The H.264 profiles tried, best first, all at level 4.0 (up to 1280 x 1280
 * at 30 frames): High, Main, and Constrained Baseline for encoders that only
 * know that one.
 */
export const VIDEO_CODECS = [
  "avc1.640028",
  "avc1.4d0028",
  "avc1.42e028",
] as const;

/** The video's size for a shape: the picture's, scaled down evenly. */
export function videoSize(preset: ImagePreset): {
  width: number;
  height: number;
} {
  const { width, height } = IMAGE_SIZE[preset];
  const even = (value: number) => 2 * Math.round((value * VIDEO_SCALE) / 2);
  return { width: even(width), height: even(height) };
}

/**
 * The engine time each frame of the video shows, in seconds: the start for
 * {@link VIDEO_LEAD}, then the animation with its holds at `fps`, then the
 * last step until the {@link VIDEO_TAIL} is reached.
 */
export function videoTimes(
  scene: TacticsScene,
  fps: number = VIDEO_FPS,
): number[] {
  const duration = sceneDuration(scene);
  const lastHold = scene.steps.at(-1)?.hold ?? 0;
  const total = VIDEO_LEAD + duration + Math.max(0, VIDEO_TAIL - lastHold);
  const count = Math.round(total * fps);
  return Array.from({ length: count }, (_, index) =>
    Math.min(Math.max(index / fps - VIDEO_LEAD, 0), duration),
  );
}

/** The video's file name, e.g. `ecke-kurz-variante-2-animation.mp4`. */
export function boardVideoName(name: string): string {
  return `${boardFileStem(name)}-animation.mp4`;
}

/** The browser has no H.264 encoder to make the video with. */
export class VideoUnsupported extends Error {
  constructor() {
    super("This browser cannot encode H.264 video");
    this.name = "VideoUnsupported";
  }
}

/** Why the video could not be made, other than the coach cancelling. */
export class BoardVideoFailure extends Error {
  constructor(cause?: unknown) {
    super("The board video could not be made", { cause });
    this.name = "BoardVideoFailure";
  }
}

/**
 * The first H.264 encoder setting the browser can encode at `size`, or `null`
 * when it has no WebCodecs or none of {@link VIDEO_CODECS}.
 */
export async function videoEncoderConfig(size: {
  width: number;
  height: number;
}): Promise<VideoEncoderConfig | null> {
  if (
    typeof globalThis.VideoEncoder !== "function" ||
    typeof globalThis.VideoFrame !== "function"
  ) {
    return null;
  }
  for (const codec of VIDEO_CODECS) {
    const config: VideoEncoderConfig = {
      codec,
      ...size,
      bitrate: VIDEO_BITRATE,
      framerate: VIDEO_FPS,
      latencyMode: "quality",
      avc: { format: "avc" },
    };
    try {
      const { supported } = await VideoEncoder.isConfigSupported(config);
      if (supported) return config;
    } catch {
      // A setting the browser cannot even read counts as unsupported.
    }
  }
  return null;
}

function bytesOf(source: AllowSharedBufferSource): Uint8Array {
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(
      source.buffer.slice(
        source.byteOffset,
        source.byteOffset + source.byteLength,
      ),
    );
  }
  return new Uint8Array(source.slice(0));
}

export interface BoardVideoJob {
  readonly scene: TacticsScene;
  readonly preset: ImagePreset;
  /**
   * Put a frame on the picture's SVG (`BoardImage`) and hand it back, drawn
   * and in the page, as the picture's dialog does for its one moment.
   */
  readonly draw: (frame: SceneFrame) => SVGSVGElement | Promise<SVGSVGElement>;
  /** Cancels the video; the promise rejects with the signal's reason. */
  readonly signal: AbortSignal;
  /** How far the video is, from 0 to 1, after each frame. */
  readonly onProgress: (share: number) => void;
}

/**
 * Make the scene's video as an MP4 file's bytes. A frame the same as the one
 * before (a hold, the lead and the tail) is not drawn again. Rejects with
 * {@link VideoUnsupported} before drawing anything when the browser cannot
 * encode it, with the signal's reason when cancelled, and with a
 * {@link BoardVideoFailure} otherwise.
 */
export async function renderBoardVideo({
  scene,
  preset,
  draw,
  signal,
  onProgress,
}: BoardVideoJob): Promise<Uint8Array<ArrayBuffer>> {
  const size = videoSize(preset);
  const config = await videoEncoderConfig(size);
  if (!config) throw new VideoUnsupported();
  signal.throwIfAborted();

  const times = videoTimes(scene);
  const frameTicks = TIMESCALE / VIDEO_FPS;
  const samples: Mp4Sample[] = [];
  // What the encoder's callbacks report, read after each frame.
  const encoded: { description: Uint8Array | null; failure: unknown } = {
    description: null,
    failure: null,
  };
  const encoder = new VideoEncoder({
    output(chunk, metadata) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const config = metadata?.decoderConfig?.description;
      if (config) encoded.description = bytesOf(config);
      samples.push({
        data,
        timestamp: Math.round((chunk.timestamp * TIMESCALE) / 1e6),
        duration: frameTicks,
        key: chunk.type === "key",
      });
    },
    error(error) {
      encoded.failure = error;
    },
  });
  try {
    encoder.configure(config);
    const ctx = boardCanvas(size.width, size.height);
    const fonts: FontCache = new Map();
    let shown: string | null = null;
    for (const [index, time] of times.entries()) {
      signal.throwIfAborted();
      if (encoded.failure) throw encoded.failure;
      const frame = frameAt(scene, time);
      const key = JSON.stringify(frame);
      if (key !== shown) {
        await paintBoard(await draw(frame), ctx, fonts);
        shown = key;
      }
      const picture = new VideoFrame(ctx.canvas, {
        timestamp: Math.round((index * 1e6) / VIDEO_FPS),
        duration: Math.round(1e6 / VIDEO_FPS),
      });
      encoder.encode(picture, {
        keyFrame: index % (KEY_EVERY * VIDEO_FPS) === 0,
      });
      picture.close();
      onProgress((index + 1) / times.length);
      // Let the encoder catch up rather than queue the whole video.
      while (encoder.encodeQueueSize > 4) {
        await new Promise((resolve) =>
          encoder.addEventListener("dequeue", resolve, { once: true }),
        );
      }
    }
    await encoder.flush();
    if (encoded.failure) throw encoded.failure;
    const { description } = encoded;
    if (!description) throw new BoardVideoFailure("no decoder configuration");
    return muxMp4({ ...size, timescale: TIMESCALE, description, samples });
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error instanceof BoardVideoFailure
      ? error
      : new BoardVideoFailure(error);
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
}
