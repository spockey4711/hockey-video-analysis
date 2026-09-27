/**
 * A small animated GIF writer for the board's video (M1), for chats that play
 * a GIF on their own and no MP4. The board is flat paint, so one palette of
 * 255 colours taken from the scene's keyframes fits every frame, and each
 * frame after the first carries only the box that changed, with the pixels
 * that stayed the same left transparent. A frame the same as the one before
 * is not written again: it lengthens the one before, so holds cost nothing.
 *
 * The file is GIF89a (the W3C GIF89a specification): a global colour table,
 * the NETSCAPE2.0 extension to loop forever, and per frame a graphic control
 * extension and an LZW-compressed image. Free of the DOM, so it is tested by
 * reading the file back.
 */

/** A colour as `0xRRGGBB`. */
export type Rgb = number;

/** The palette's size in the file: 8 bits per pixel. */
const TABLE_SIZE = 256;

/** The palette index the frames after the first use for "unchanged". */
export const TRANSPARENT = TABLE_SIZE - 1;

/** Colours the palette can hold next to {@link TRANSPARENT}. */
export const PALETTE_COLORS = TABLE_SIZE - 1;

/** LZW codes are at most 12 bits long. */
const MAX_CODES = 4096;

/** Count each colour of `rgba` (red, green, blue, alpha bytes) in `counts`. */
export function countColors(
  rgba: Uint8ClampedArray,
  counts: Map<Rgb, number>,
): void {
  for (let at = 0; at < rgba.length; at += 4) {
    const rgb = (rgba[at]! << 16) | (rgba[at + 1]! << 8) | rgba[at + 2]!;
    counts.set(rgb, (counts.get(rgb) ?? 0) + 1);
  }
}

const channel = (rgb: Rgb, shift: number) => (rgb >> shift) & 0xff;

interface Box {
  readonly colors: Rgb[];
  readonly weight: number;
  /** The channel's shift with the widest spread, and that spread. */
  readonly shift: number;
  readonly range: number;
}

function box(colors: Rgb[], counts: ReadonlyMap<Rgb, number>): Box {
  let weight = 0;
  let shift = 16;
  let range = -1;
  for (const colour of colors) weight += counts.get(colour) ?? 0;
  for (const at of [16, 8, 0]) {
    let low = 255;
    let high = 0;
    for (const colour of colors) {
      const value = channel(colour, at);
      if (value < low) low = value;
      if (value > high) high = value;
    }
    if (high - low > range) {
      range = high - low;
      shift = at;
    }
  }
  return { colors, weight, shift, range };
}

/**
 * The colour a box stands for: its most common colour when that is most of
 * the box, so the pitch and the team colours stay exact, and otherwise the
 * box's average.
 */
function representative(
  { colors, weight }: Box,
  counts: ReadonlyMap<Rgb, number>,
): Rgb {
  let top = colors[0]!;
  const sum = [0, 0, 0];
  for (const colour of colors) {
    const count = counts.get(colour) ?? 0;
    if (count > (counts.get(top) ?? 0)) top = colour;
    sum[0]! += channel(colour, 16) * count;
    sum[1]! += channel(colour, 8) * count;
    sum[2]! += channel(colour, 0) * count;
  }
  if (2 * (counts.get(top) ?? 0) >= weight) return top;
  const [red, green, blue] = sum.map((value) =>
    Math.round(value / Math.max(weight, 1)),
  );
  return (red! << 16) | (green! << 8) | blue!;
}

/**
 * At most `size` colours standing for the counted ones: all of them when they
 * fit, otherwise a median cut that keeps splitting the box with the most
 * pixels times the widest spread.
 */
export function buildPalette(
  counts: ReadonlyMap<Rgb, number>,
  size: number = PALETTE_COLORS,
): Rgb[] {
  const all = [...counts.keys()];
  if (all.length <= size) return all;
  const boxes = [box(all, counts)];
  while (boxes.length < size) {
    let widest = -1;
    for (const [index, candidate] of boxes.entries()) {
      if (candidate.colors.length < 2) continue;
      const score = candidate.weight * candidate.range;
      if (widest < 0 || score > boxes[widest]!.weight * boxes[widest]!.range) {
        widest = index;
      }
    }
    if (widest < 0) break;
    const { colors, weight, shift } = boxes[widest]!;
    colors.sort((a, b) => channel(a, shift) - channel(b, shift));
    // Split at the weighted median, leaving at least one colour each side.
    let seen = 0;
    let cut = 1;
    for (; cut < colors.length - 1; cut += 1) {
      seen += counts.get(colors[cut - 1]!) ?? 0;
      if (2 * seen >= weight) break;
    }
    boxes.splice(
      widest,
      1,
      box(colors.slice(0, cut), counts),
      box(colors.slice(cut), counts),
    );
  }
  return boxes.map((each) => representative(each, counts));
}

/** Each colour's nearest palette entry, remembered once looked up. */
export class PaletteMap {
  private readonly known = new Map<Rgb, number>();

  constructor(private readonly palette: readonly Rgb[]) {
    if (palette.length === 0 || palette.length > PALETTE_COLORS) {
      throw new RangeError(`A palette holds 1 to ${PALETTE_COLORS} colours`);
    }
  }

  index(rgb: Rgb): number {
    const known = this.known.get(rgb);
    if (known !== undefined) return known;
    let best = 0;
    let bestDistance = Infinity;
    for (const [index, colour] of this.palette.entries()) {
      const red = channel(colour, 16) - channel(rgb, 16);
      const green = channel(colour, 8) - channel(rgb, 8);
      const blue = channel(colour, 0) - channel(rgb, 0);
      const distance = red * red + green * green + blue * blue;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
        if (distance === 0) break;
      }
    }
    this.known.set(rgb, best);
    return best;
  }
}

/** Collects bytes, and bits least significant first, into one array. */
class ByteSink {
  private buffer = new Uint8Array(1 << 16);
  length = 0;
  private bits = 0;
  private bitCount = 0;

  byte(value: number): void {
    if (this.length === this.buffer.length) {
      const grown = new Uint8Array(this.buffer.length * 2);
      grown.set(this.buffer);
      this.buffer = grown;
    }
    this.buffer[this.length++] = value & 0xff;
  }

  bytes(values: ArrayLike<number>): void {
    for (let at = 0; at < values.length; at += 1) this.byte(values[at]!);
  }

  u16(value: number): void {
    this.byte(value);
    this.byte(value >> 8);
  }

  ascii(text: string): void {
    for (const char of text) this.byte(char.charCodeAt(0));
  }

  code(value: number, size: number): void {
    this.bits |= value << this.bitCount;
    this.bitCount += size;
    while (this.bitCount >= 8) {
      this.byte(this.bits);
      this.bits >>>= 8;
      this.bitCount -= 8;
    }
  }

  flushBits(): void {
    if (this.bitCount > 0) this.byte(this.bits);
    this.bits = 0;
    this.bitCount = 0;
  }

  result(): Uint8Array<ArrayBuffer> {
    return this.buffer.slice(0, this.length);
  }
}

/**
 * The GIF variant of LZW over palette indices of `minCodeSize` bits: codes
 * grow from `minCodeSize + 1` to 12 bits, and a clear code starts a new table
 * once all 4096 codes are taken.
 */
export function lzwEncode(
  indices: Uint8Array,
  minCodeSize: number,
): Uint8Array<ArrayBuffer> {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const sink = new ByteSink();
  const table = new Map<number, number>();
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  // A code, then one bit more once the next code would not fit, as the
  // decoder widens its reads when its table reaches that size.
  const emit = (code: number) => {
    sink.code(code, codeSize);
    if (next >= 1 << codeSize && codeSize < 12) codeSize += 1;
  };
  sink.code(clear, codeSize);
  if (indices.length > 0) {
    let prefix = indices[0]!;
    for (let at = 1; at < indices.length; at += 1) {
      const symbol = indices[at]!;
      const key = (prefix << 8) | symbol;
      const known = table.get(key);
      if (known !== undefined) {
        prefix = known;
        continue;
      }
      emit(prefix);
      if (next < MAX_CODES) {
        table.set(key, next);
        next += 1;
      } else {
        sink.code(clear, codeSize);
        table.clear();
        codeSize = minCodeSize + 1;
        next = end + 1;
      }
      prefix = symbol;
    }
    emit(prefix);
  }
  sink.code(end, codeSize);
  sink.flushBits();
  return sink.result();
}

/** A frame waiting for its delay, which the frames after it may lengthen. */
interface Pending {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly indices: Uint8Array;
  readonly transparent: boolean;
  delay: number;
}

export interface GifOptions {
  readonly width: number;
  readonly height: number;
  /** At most {@link PALETTE_COLORS} colours, from {@link buildPalette}. */
  readonly palette: readonly Rgb[];
  /** How long each frame given shows, in hundredths of a second. */
  readonly frameDelay: number;
}

/**
 * An animated GIF made frame by frame, looping forever. Each frame is mapped
 * to the palette's nearest colours as it comes, so only the current and the
 * last frame are held, not the whole animation.
 */
export class GifAnimation {
  private readonly sink = new ByteSink();
  private readonly map: PaletteMap;
  private shown: Uint8Array | null = null;
  private lastRgba: Uint32Array | null = null;
  private pending: Pending | null = null;
  /** Frames written to the file so far. */
  frames = 0;

  constructor(private readonly options: GifOptions) {
    const { width, height, palette } = options;
    this.map = new PaletteMap(palette);
    const { sink } = this;
    sink.ascii("GIF89a");
    sink.u16(width);
    sink.u16(height);
    // A global table of 256 entries, 8 bits of colour resolution.
    sink.byte(0xf7);
    sink.byte(0); // background colour index
    sink.byte(0); // no pixel aspect ratio
    for (let index = 0; index < TABLE_SIZE; index += 1) {
      const colour = palette[index] ?? 0;
      sink.bytes([channel(colour, 16), channel(colour, 8), channel(colour, 0)]);
    }
    // NETSCAPE2.0: loop forever.
    sink.bytes([0x21, 0xff, 0x0b]);
    sink.ascii("NETSCAPE2.0");
    sink.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);
  }

  /** Add a frame of `width` x `height` RGBA pixels; alpha is ignored. */
  add(rgba: Uint8ClampedArray): void {
    const { width, height } = this.options;
    if (rgba.length !== width * height * 4) {
      throw new RangeError("The frame is not the animation's size");
    }
    const words = new Uint32Array(
      rgba.buffer,
      rgba.byteOffset,
      rgba.length / 4,
    );
    const indices = new Uint8Array(width * height);
    const { shown, lastRgba } = this;
    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = y * width + x;
        const word = words[at]!;
        if (shown && lastRgba && lastRgba[at] === word) {
          indices[at] = shown[at]!;
          continue;
        }
        const index = this.map.index(
          (rgba[at * 4]! << 16) | (rgba[at * 4 + 1]! << 8) | rgba[at * 4 + 2]!,
        );
        indices[at] = index;
        if (shown && shown[at] !== index) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    this.lastRgba = new Uint32Array(words);
    if (!shown) {
      this.queue({ x: 0, y: 0, width, height, indices, transparent: false });
    } else if (right < 0) {
      this.repeat();
    } else {
      const boxWidth = right - left + 1;
      const boxHeight = bottom - top + 1;
      const changed = new Uint8Array(boxWidth * boxHeight);
      for (let y = 0; y < boxHeight; y += 1) {
        for (let x = 0; x < boxWidth; x += 1) {
          const at = (top + y) * width + left + x;
          changed[y * boxWidth + x] =
            indices[at] === shown[at] ? TRANSPARENT : indices[at]!;
        }
      }
      this.queue({
        x: left,
        y: top,
        width: boxWidth,
        height: boxHeight,
        indices: changed,
        transparent: true,
      });
    }
    this.shown = indices;
  }

  /** Show the last frame for one frame longer. */
  repeat(): void {
    if (!this.pending) throw new Error("No frame to repeat");
    this.pending.delay += this.options.frameDelay;
  }

  /** The finished file. */
  finish(): Uint8Array<ArrayBuffer> {
    this.flush();
    this.sink.byte(0x3b);
    return this.sink.result();
  }

  private queue(frame: Omit<Pending, "delay">): void {
    this.flush();
    this.pending = { ...frame, delay: this.options.frameDelay };
  }

  private flush(): void {
    const frame = this.pending;
    if (!frame) return;
    this.pending = null;
    const { sink } = this;
    // Graphic control: keep the frame for the next to draw over.
    sink.bytes([0x21, 0xf9, 0x04, (1 << 2) | (frame.transparent ? 1 : 0)]);
    sink.u16(Math.min(frame.delay, 0xffff));
    sink.bytes([TRANSPARENT, 0x00]);
    sink.byte(0x2c);
    sink.u16(frame.x);
    sink.u16(frame.y);
    sink.u16(frame.width);
    sink.u16(frame.height);
    sink.byte(0); // no local colour table, not interlaced
    sink.byte(8); // LZW minimum code size
    const data = lzwEncode(frame.indices, 8);
    for (let at = 0; at < data.length; at += 255) {
      const block = data.subarray(at, at + 255);
      sink.byte(block.length);
      sink.bytes(block);
    }
    sink.byte(0);
    this.frames += 1;
  }
}
