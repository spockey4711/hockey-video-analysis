import { describe, expect, it } from "vitest";

import { muxMp4, runs, type Mp4Sample } from "@/features/tactics/mp4";

interface Box {
  readonly type: string;
  readonly start: number;
  readonly size: number;
  readonly body: DataView;
}

/** The boxes laid one after the other in `view`. */
function boxes(view: DataView): Box[] {
  const out: Box[] = [];
  let at = 0;
  while (at < view.byteLength) {
    const size = view.getUint32(at);
    const type = String.fromCharCode(
      ...new Uint8Array(view.buffer, view.byteOffset + at + 4, 4),
    );
    out.push({
      type,
      start: view.byteOffset + at,
      size,
      body: new DataView(view.buffer, view.byteOffset + at + 8, size - 8),
    });
    at += size;
  }
  return out;
}

/** The box at a path of types, e.g. `moov/trak/mdia`, with `skip` bytes before its children. */
function find(file: Uint8Array, path: string): Box {
  const skips: Record<string, number> = { stsd: 8, avc1: 78, dref: 8 };
  let view = new DataView(file.buffer);
  let found: Box | undefined;
  for (const type of path.split("/")) {
    found = boxes(view).find((box) => box.type === type);
    if (!found) throw new Error(`no ${type} in ${path}`);
    const skip = skips[type] ?? 0;
    view = new DataView(
      found.body.buffer,
      found.body.byteOffset + skip,
      found.body.byteLength - skip,
    );
  }
  return found as Box;
}

/** A full box's entries as 32-bit words after its version, flags and count. */
function words(box: Box): number[] {
  const out: number[] = [];
  for (let at = 8; at < box.body.byteLength; at += 4) {
    out.push(box.body.getUint32(at));
  }
  return out;
}

const DESCRIPTION = new Uint8Array([1, 0x64, 0, 0x28, 0xff]);

function sample(
  index: number,
  key: boolean,
  bytes: number[],
  timestamp = index * 3000,
): Mp4Sample {
  return {
    data: new Uint8Array(bytes),
    timestamp,
    duration: 3000,
    key,
  };
}

const SAMPLES = [
  sample(0, true, [1, 2, 3]),
  sample(1, false, [4, 5]),
  sample(2, false, [6]),
  sample(3, true, [7, 8, 9, 10]),
];

function mux(samples: readonly Mp4Sample[] = SAMPLES): Uint8Array {
  return muxMp4({
    width: 1280,
    height: 720,
    timescale: 90_000,
    description: DESCRIPTION,
    samples,
  });
}

describe("runs", () => {
  it("counts consecutive equal values", () => {
    expect(runs([3, 3, 3, 1, 3])).toEqual([
      [3, 3],
      [1, 1],
      [1, 3],
    ]);
    expect(runs([])).toEqual([]);
  });
});

describe("muxMp4", () => {
  it("lays out the file type, the movie, then the media data", () => {
    const file = mux();
    expect(boxes(new DataView(file.buffer)).map((box) => box.type)).toEqual([
      "ftyp",
      "moov",
      "mdat",
    ]);
    const ftyp = find(file, "ftyp");
    expect(
      String.fromCharCode(...new Uint8Array(file.buffer, ftyp.start + 8, 4)),
    ).toBe("isom");
  });

  it("points the one chunk at the samples in the media data", () => {
    const file = mux();
    const mdat = find(file, "mdat");
    const [offset] = words(find(file, "moov/trak/mdia/minf/stbl/stco"));
    expect(offset).toBe(mdat.start + 8);
    expect([...file.subarray(mdat.start + 8)]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(words(find(file, "moov/trak/mdia/minf/stbl/stsc"))).toEqual([
      1, 4, 1,
    ]);
    // A size of 0 then the count, then each sample's size.
    const stsz = find(file, "moov/trak/mdia/minf/stbl/stsz");
    expect([stsz.body.getUint32(4), ...words(stsz)]).toEqual([
      0, 4, 3, 2, 1, 4,
    ]);
  });

  it("stores the frame times, key frames and decoder configuration", () => {
    const file = mux();
    const stbl = "moov/trak/mdia/minf/stbl";
    // One run of four frames of 3000 ticks.
    expect(words(find(file, `${stbl}/stts`))).toEqual([4, 3000]);
    expect(words(find(file, `${stbl}/stss`))).toEqual([1, 4]);
    const avcC = find(file, `${stbl}/stsd/avc1/avcC`);
    expect([...new Uint8Array(avcC.body.buffer, avcC.start + 8, 5)]).toEqual([
      ...DESCRIPTION,
    ]);
    const avc1 = find(file, `${stbl}/stsd/avc1`);
    expect(avc1.body.getUint16(24)).toBe(1280);
    expect(avc1.body.getUint16(26)).toBe(720);
    expect(() => find(file, `${stbl}/ctts`)).toThrow();
  });

  it("gives the movie and the track the video's length and size", () => {
    const file = mux();
    const mdhd = find(file, "moov/trak/mdia/mdhd");
    expect(mdhd.body.getUint32(12)).toBe(90_000);
    expect(mdhd.body.getUint32(16)).toBe(12_000);
    // The movie counts milliseconds: four frames at 30 a second.
    const mvhd = find(file, "moov/mvhd");
    expect(mvhd.body.getUint32(12)).toBe(1000);
    expect(mvhd.body.getUint32(16)).toBe(133);
    const tkhd = find(file, "moov/trak/tkhd");
    expect(tkhd.body.getUint32(76) / 0x10000).toBe(1280);
    expect(tkhd.body.getUint32(80) / 0x10000).toBe(720);
    const hdlr = find(file, "moov/trak/mdia/hdlr");
    expect(
      String.fromCharCode(
        ...new Uint8Array(hdlr.body.buffer, hdlr.start + 16, 4),
      ),
    ).toBe("vide");
  });

  it("offsets frames that show later or earlier than they decode", () => {
    // Decode order I P B: the P frame shows third, the B frame second.
    const file = mux([
      sample(0, true, [1]),
      sample(1, false, [2], 6000),
      sample(2, false, [3], 3000),
    ]);
    const ctts = find(file, "moov/trak/mdia/minf/stbl/ctts");
    expect(ctts.body.getUint8(0)).toBe(1);
    expect(words(ctts).map((word) => word | 0)).toEqual([
      1, 0, 1, 3000, 1, -3000,
    ]);
  });
});
