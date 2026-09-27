import { describe, expect, it } from "vitest";

import { lzwDecode, readGif } from "./read-gif";

import {
  buildPalette,
  countColors,
  GifAnimation,
  lzwEncode,
  PaletteMap,
  TRANSPARENT,
  type Rgb,
} from "@/features/tactics/gif";

/** An RGBA frame of `width` x `height` in one colour, then `paint` on it. */
function rgbaFrame(
  width: number,
  height: number,
  fill: Rgb,
  paint: (set: (x: number, y: number, colour: Rgb) => void) => void = () => {},
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const set = (x: number, y: number, colour: Rgb) => {
    const at = (y * width + x) * 4;
    rgba[at] = colour >> 16;
    rgba[at + 1] = (colour >> 8) & 0xff;
    rgba[at + 2] = colour & 0xff;
    rgba[at + 3] = 255;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) set(x, y, fill);
  }
  paint(set);
  return rgba;
}

const PITCH = 0x2f7d4a;
const HOME = 0xd23c3c;
const AWAY = 0x2c5fd6;

describe("lzwEncode", () => {
  it("round-trips short, repetitive and table-filling data", () => {
    const noise = new Uint8Array(60_000);
    let seed = 7;
    for (let index = 0; index < noise.length; index += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[index] = seed % 256;
    }
    for (const data of [
      new Uint8Array([]),
      new Uint8Array([5]),
      new Uint8Array(10_000).fill(3),
      Uint8Array.from({ length: 20_000 }, (_, index) => index % 7),
      noise,
    ]) {
      expect(lzwDecode(lzwEncode(data, 8), 8)).toEqual([...data]);
    }
  });

  it("compresses a flat area to a few bytes", () => {
    expect(lzwEncode(new Uint8Array(720 * 405), 8).length).toBeLessThan(2000);
  });
});

describe("buildPalette", () => {
  it("keeps every colour when they fit", () => {
    const counts = new Map([
      [PITCH, 100],
      [HOME, 5],
    ]);
    expect(buildPalette(counts).sort()).toEqual([PITCH, HOME].sort());
  });

  it("cuts many colours down and keeps the common ones exact", () => {
    const counts = new Map<Rgb, number>([
      [PITCH, 1_000_000],
      [HOME, 50_000],
      [AWAY, 50_000],
    ]);
    // Anti-aliased edges: a spread of rare colours.
    for (let index = 0; index < 4000; index += 1) {
      counts.set((index * 2654435761) & 0xffffff, 1);
    }
    const palette = buildPalette(counts, 16);
    expect(palette).toHaveLength(16);
    expect(palette).toEqual(expect.arrayContaining([PITCH, HOME, AWAY]));
  });
});

describe("PaletteMap", () => {
  it("maps a colour to its nearest entry", () => {
    const map = new PaletteMap([PITCH, HOME, AWAY]);
    expect(map.index(HOME)).toBe(1);
    expect(map.index(0xd0403a)).toBe(1);
    expect(map.index(0x3060d0)).toBe(2);
  });

  it("refuses a palette that leaves no transparent index", () => {
    expect(() => new PaletteMap([])).toThrow(RangeError);
    expect(() => new PaletteMap(Array.from({ length: 256 }, () => 0))).toThrow(
      RangeError,
    );
  });
});

describe("countColors", () => {
  it("counts each pixel's colour and ignores alpha", () => {
    const counts = new Map<Rgb, number>();
    countColors(
      rgbaFrame(3, 2, PITCH, (set) => set(1, 1, HOME)),
      counts,
    );
    expect([...counts]).toEqual([
      [PITCH, 5],
      [HOME, 1],
    ]);
  });
});

describe("GifAnimation", () => {
  const disc = (at: number) =>
    rgbaFrame(20, 10, PITCH, (set) => {
      for (let y = 4; y < 7; y += 1) {
        for (let x = at; x < at + 3; x += 1) set(x, y, HOME);
      }
    });

  it("writes a looping GIF89a of the frames, holds folded into delays", () => {
    const gif = new GifAnimation({
      width: 20,
      height: 10,
      palette: [PITCH, HOME],
      frameDelay: 8,
    });
    gif.add(disc(2));
    gif.repeat();
    gif.add(disc(2)); // the same picture again: a longer delay, no frame
    gif.add(disc(5));
    gif.add(disc(9));
    gif.repeat();
    const file = readGif(gif.finish());

    expect(file).toMatchObject({ width: 20, height: 10, loops: 0 });
    expect(file.palette.slice(0, 2)).toEqual([PITCH, HOME]);
    expect(file.palette).toHaveLength(256);
    expect(gif.frames).toBe(3);
    expect(file.frames.map((frame) => frame.delay)).toEqual([24, 8, 16]);
    // Every frame stays for the next to draw over.
    expect(file.frames.every((frame) => frame.disposal === 1)).toBe(true);

    const [first, second, third] = file.frames;
    expect(first).toMatchObject({ x: 0, y: 0, width: 20, height: 10 });
    expect(first!.transparent).toBe(false);
    expect(first!.indices[5 * 20 + 3]).toBe(1);
    expect(first!.indices[0]).toBe(0);
    // Only the box that changed, the rest of it transparent.
    expect(second).toMatchObject({ x: 2, y: 4, width: 6, height: 3 });
    expect(second!.transparent).toBe(true);
    expect(second!.indices.slice(0, 6)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(third).toMatchObject({ x: 5, y: 4, width: 7, height: 3 });
    expect(third!.indices.slice(0, 7)).toEqual([0, 0, 0, TRANSPARENT, 1, 1, 1]);
  });

  it("maps colours outside the palette to the nearest", () => {
    const gif = new GifAnimation({
      width: 2,
      height: 1,
      palette: [PITCH, HOME],
      frameDelay: 8,
    });
    gif.add(rgbaFrame(2, 1, 0x307c4b, (set) => set(1, 0, 0xcc4040)));
    const [frame] = readGif(gif.finish()).frames;
    expect(frame!.indices).toEqual([0, 1]);
  });

  it("refuses a frame of another size and a repeat before any frame", () => {
    const gif = new GifAnimation({
      width: 4,
      height: 4,
      palette: [PITCH],
      frameDelay: 8,
    });
    expect(() => gif.repeat()).toThrow();
    expect(() => gif.add(rgbaFrame(2, 2, PITCH))).toThrow(RangeError);
  });
});
