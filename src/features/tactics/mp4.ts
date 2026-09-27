/**
 * A minimal MP4 writer for the board's video (M1): one H.264 video track, the
 * encoded samples in one chunk, and the movie box ahead of the media data so
 * a player can start before the file has fully arrived. The browser's
 * WebCodecs encoder makes the samples and their `avcC` decoder configuration;
 * this only packs them into the ISO base media file format (ISO/IEC 14496-12
 * and 14496-15) that phones, chat apps and QuickTime play.
 *
 * Free of the DOM, so it is tested by reading the boxes back.
 */

/** One encoded video frame, in decode order. */
export interface Mp4Sample {
  readonly data: Uint8Array;
  /** When the frame shows, in media timescale ticks. */
  readonly timestamp: number;
  /** How long it shows, in media timescale ticks. */
  readonly duration: number;
  /** A key frame a player can start decoding from. */
  readonly key: boolean;
}

export interface Mp4Track {
  readonly width: number;
  readonly height: number;
  /** Ticks per second of the samples' times. */
  readonly timescale: number;
  /** The encoder's `AVCDecoderConfigurationRecord` (`avcC`). */
  readonly description: Uint8Array;
  readonly samples: readonly Mp4Sample[];
}

/** The movie header's own timescale: milliseconds. */
const MOVIE_TIMESCALE = 1000;

/** The identity transform every track header and movie header carries. */
const UNITY_MATRIX = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];

type Part = Uint8Array | readonly number[];

function u8(value: number): number[] {
  return [value & 0xff];
}

function u16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function u32(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0) & 0xff);
}

function concat(parts: readonly Part[]): Uint8Array<ArrayBuffer> {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A box: its 32-bit size, its four-letter type, then its content. */
function box(type: string, ...content: readonly Part[]): Uint8Array {
  const body = concat(content);
  return concat([u32(body.length + 8), ascii(type), body]);
}

/** A full box: a box whose content starts with a version and 24 bits of flags. */
function fullBox(
  type: string,
  version: number,
  flags: number,
  ...content: readonly Part[]
): Uint8Array {
  return box(type, u8(version), u32(flags).slice(1), ...content);
}

/** A 16.16 fixed-point number. */
function fixed16(value: number): number[] {
  return u32(Math.round(value * 0x10000));
}

/** Consecutive equal values as `[count, value]` runs, as `stts` and `ctts` store them. */
export function runs(values: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const value of values) {
    const last = out.at(-1);
    if (last && last[1] === value) last[0] += 1;
    else out.push([1, value]);
  }
  return out;
}

function sampleTable(track: Mp4Track, mdatStart: number): Uint8Array {
  const { samples } = track;
  // Each sample's decode time is the sum of the durations before it; a frame
  // shown later than it decodes (a reordered one) needs a composition offset.
  let decodeTime = 0;
  const offsets = samples.map((sample) => {
    const offset = sample.timestamp - decodeTime;
    decodeTime += sample.duration;
    return offset;
  });
  const reordered = offsets.some((offset) => offset !== 0);
  const durations = runs(samples.map((sample) => sample.duration));
  const keys = samples.flatMap((sample, index) =>
    sample.key ? [index + 1] : [],
  );
  const avc1 = box(
    "avc1",
    [0, 0, 0, 0, 0, 0], // reserved
    u16(1), // data reference index
    new Array<number>(16).fill(0), // pre-defined and reserved
    u16(track.width),
    u16(track.height),
    fixed16(72), // horizontal resolution, dpi
    fixed16(72), // vertical resolution, dpi
    u32(0), // reserved
    u16(1), // frames per sample
    new Array<number>(32).fill(0), // compressor name
    u16(0x18), // depth: colour, no alpha
    u16(0xffff), // pre-defined: -1
    box("avcC", track.description),
  );
  return box(
    "stbl",
    fullBox("stsd", 0, 0, u32(1), avc1),
    fullBox(
      "stts",
      0,
      0,
      u32(durations.length),
      durations.flatMap(([count, duration]) => [
        ...u32(count),
        ...u32(duration),
      ]),
    ),
    ...(reordered
      ? [
          // Version 1 stores signed offsets, for a frame shown before it decodes.
          fullBox(
            "ctts",
            offsets.some((offset) => offset < 0) ? 1 : 0,
            0,
            u32(runs(offsets).length),
            runs(offsets).flatMap(([count, offset]) => [
              ...u32(count),
              ...u32(offset),
            ]),
          ),
        ]
      : []),
    fullBox("stss", 0, 0, u32(keys.length), keys.flatMap(u32)),
    // All samples in one chunk.
    fullBox("stsc", 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
    fullBox(
      "stsz",
      0,
      0,
      u32(0),
      u32(samples.length),
      samples.flatMap((sample) => u32(sample.data.length)),
    ),
    fullBox("stco", 0, 0, u32(1), u32(mdatStart)),
  );
}

function movie(track: Mp4Track, mdatStart: number): Uint8Array {
  const mediaDuration = track.samples.reduce(
    (total, sample) => total + sample.duration,
    0,
  );
  const duration = Math.round(
    (mediaDuration * MOVIE_TIMESCALE) / track.timescale,
  );
  const matrix = UNITY_MATRIX.flatMap(u32);
  return box(
    "moov",
    fullBox(
      "mvhd",
      0,
      0,
      u32(0), // created
      u32(0), // modified
      u32(MOVIE_TIMESCALE),
      u32(duration),
      fixed16(1), // rate
      u16(0x0100), // volume
      new Array<number>(10).fill(0), // reserved
      matrix,
      new Array<number>(24).fill(0), // pre-defined
      u32(2), // next track id
    ),
    box(
      "trak",
      fullBox(
        "tkhd",
        0,
        3, // enabled, in the movie
        u32(0), // created
        u32(0), // modified
        u32(1), // track id
        u32(0), // reserved
        u32(duration),
        new Array<number>(8).fill(0), // reserved
        u16(0), // layer
        u16(0), // alternate group
        u16(0), // volume: a video track has none
        u16(0), // reserved
        matrix,
        fixed16(track.width),
        fixed16(track.height),
      ),
      box(
        "mdia",
        fullBox(
          "mdhd",
          0,
          0,
          u32(0), // created
          u32(0), // modified
          u32(track.timescale),
          u32(mediaDuration),
          u16(0x55c4), // language: "und"
          u16(0), // pre-defined
        ),
        fullBox(
          "hdlr",
          0,
          0,
          u32(0), // pre-defined
          ascii("vide"),
          new Array<number>(12).fill(0), // reserved
          ascii("VideoHandler"),
          [0],
        ),
        box(
          "minf",
          fullBox("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)),
          box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1))),
          sampleTable(track, mdatStart),
        ),
      ),
    ),
  );
}

/** The MP4 file of one H.264 track, movie box first. */
export function muxMp4(track: Mp4Track): Uint8Array<ArrayBuffer> {
  const ftyp = box(
    "ftyp",
    ascii("isom"),
    u32(0x200),
    ascii("isom"),
    ascii("iso2"),
    ascii("avc1"),
    ascii("mp41"),
  );
  const data = concat(track.samples.map((sample) => sample.data));
  // The movie box's size does not depend on where the media data starts, so
  // one draft pass finds that offset.
  const moovSize = movie(track, 0).length;
  const mdatStart = ftyp.length + moovSize + 8;
  return concat([ftyp, movie(track, mdatStart), box("mdat", data)]);
}
