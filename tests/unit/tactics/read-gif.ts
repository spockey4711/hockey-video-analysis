/**
 * Reads a GIF back for the tests: its header, palette, loop count and frames,
 * with an LZW decoder of its own that works as a browser's does.
 */
import { expect } from "vitest";

import { TRANSPARENT, type Rgb } from "@/features/tactics/gif";

/** Undo the GIF variant of LZW, as a browser's decoder does. */
export function lzwDecode(data: Uint8Array, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out: number[] = [];
  let table: number[][] = [];
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let prev: number[] | null = null;
  const reset = () => {
    table = Array.from({ length: clear }, (_, index) => [index]);
    codeSize = minCodeSize + 1;
    next = end + 1;
    prev = null;
  };
  reset();
  let bits = 0;
  let bitCount = 0;
  let at = 0;
  for (;;) {
    while (bitCount < codeSize) {
      if (at >= data.length) throw new Error("ran out of data");
      bits |= data[at++]! << bitCount;
      bitCount += 8;
    }
    const code = bits & ((1 << codeSize) - 1);
    bits >>>= codeSize;
    bitCount -= codeSize;
    if (code === clear) {
      reset();
      continue;
    }
    if (code === end) break;
    let entry: number[];
    if (code < next && table[code]) {
      entry = table[code]!;
    } else if (code === next && prev) {
      entry = [...prev, prev[0]!];
    } else {
      throw new Error(`bad code ${code}`);
    }
    out.push(...entry);
    if (prev && next < 4096) {
      table[next] = [...prev, entry[0]!];
      next += 1;
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
    }
    prev = entry;
  }
  return out;
}

export interface ReadFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  transparent: boolean;
  disposal: number;
  indices: number[];
}

/** Read a GIF back: its header, palette, loop and frames. */
export function readGif(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (from: number, length: number) =>
    String.fromCharCode(...bytes.subarray(from, from + length));
  expect(text(0, 6)).toBe("GIF89a");
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const packed = bytes[10]!;
  expect(packed & 0x80).toBe(0x80);
  const tableSize = 2 << (packed & 7);
  const palette: Rgb[] = [];
  let at = 13;
  for (let index = 0; index < tableSize; index += 1, at += 3) {
    palette.push((bytes[at]! << 16) | (bytes[at + 1]! << 8) | bytes[at + 2]!);
  }
  const blocks = () => {
    const data: number[] = [];
    for (let size = bytes[at++]!; size > 0; size = bytes[at++]!) {
      data.push(...bytes.subarray(at, at + size));
      at += size;
    }
    return new Uint8Array(data);
  };
  let loops: number | null = null;
  const frames: ReadFrame[] = [];
  let control = { delay: 0, transparent: false, disposal: 0 };
  for (;;) {
    const kind = bytes[at++];
    if (kind === 0x3b) break;
    if (kind === 0x21) {
      const label = bytes[at++];
      if (label === 0xff) {
        const app = blocks();
        // The identifier's block, then the loop count's.
        expect(String.fromCharCode(...app.subarray(0, 11))).toBe("NETSCAPE2.0");
        expect(app[11]).toBe(1);
        loops = app[12]! | (app[13]! << 8);
      } else if (label === 0xf9) {
        const data = blocks();
        control = {
          delay: data[1]! | (data[2]! << 8),
          transparent: (data[0]! & 1) === 1,
          disposal: (data[0]! >> 2) & 7,
        };
        expect(data[3]).toBe(TRANSPARENT);
      } else {
        blocks();
      }
    } else if (kind === 0x2c) {
      const x = view.getUint16(at, true);
      const y = view.getUint16(at + 2, true);
      const frameWidth = view.getUint16(at + 4, true);
      const frameHeight = view.getUint16(at + 6, true);
      expect(bytes[at + 8]).toBe(0);
      at += 9;
      const minCodeSize = bytes[at++]!;
      const indices = lzwDecode(blocks(), minCodeSize);
      expect(indices).toHaveLength(frameWidth * frameHeight);
      frames.push({
        x,
        y,
        width: frameWidth,
        height: frameHeight,
        ...control,
        indices,
      });
    } else {
      throw new Error(`unknown block ${kind}`);
    }
  }
  expect(at).toBe(bytes.length);
  return { width, height, palette, loops, frames };
}
