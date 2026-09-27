/**
 * The outlines of the board's zones and the box round a text, as SVG path
 * data in pitch metres. Pure, so the editor, the collection stage and the
 * picture draw them alike.
 */
import type { BoardZone } from "./scene";

/** A number short enough for path data: to the millimetre. */
function n(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * A zone's outline: a box between its two corners, the oval filling that box,
 * or the polygon through its corners, closed.
 */
export function zonePath(zone: BoardZone): string {
  const [a, b] = zone.points;
  if (!a) return "";
  if (zone.kind === "polygon") {
    const [first, ...rest] = zone.points;
    if (!first) return "";
    return `M${n(first.x)} ${n(first.y)}${rest
      .map((point) => `L${n(point.x)} ${n(point.y)}`)
      .join("")}Z`;
  }
  if (!b) return "";
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  if (zone.kind === "rect")
    return `M${n(left)} ${n(top)}H${n(right)}V${n(bottom)}H${n(left)}Z`;
  const rx = n((right - left) / 2);
  const ry = n((bottom - top) / 2);
  const cy = n((top + bottom) / 2);
  // Two half arcs round the box's middle line.
  return `M${n(left)} ${cy}A${rx} ${ry} 0 1 0 ${n(right)} ${cy}A${rx} ${ry} 0 1 0 ${n(left)} ${cy}Z`;
}

/**
 * A generous average glyph width in the app font, in ems. An SVG box cannot
 * grow with its text, so a bubble and a text's hit area are sized from it.
 */
export const TEXT_CHAR_WIDTH = 0.6;

/** The box round a text centred on its point, in metres. */
export interface TextBox {
  readonly width: number;
  readonly height: number;
}

/** How much room a text takes at a font size: in a bubble, with its padding. */
export function textBox(
  text: string,
  fontSize: number,
  bubble: boolean,
): TextBox {
  const pad = bubble ? 0.5 : 0.2;
  return {
    width: ([...text].length * TEXT_CHAR_WIDTH + pad * 2) * fontSize,
    height: (bubble ? 1.6 : 1.3) * fontSize,
  };
}

/**
 * A speech bubble round a text box centred on the origin: a rounded box with
 * a tail below its left part, pointing down and a little left, as a comic
 * draws it. One outline, so its edge shows no seam where the tail joins.
 */
export function bubblePath(box: TextBox, fontSize: number): string {
  const left = -box.width / 2;
  const right = box.width / 2;
  const top = -box.height / 2;
  const bottom = box.height / 2;
  const r = n(Math.min(fontSize * 0.4, box.height / 2));
  const tailStart = left + Math.max(r, box.width * 0.18);
  const tailEnd = tailStart + fontSize * 0.6;
  const tip = { x: tailStart - fontSize * 0.15, y: bottom + fontSize * 0.7 };
  return [
    `M${n(left + r)} ${n(top)}`,
    `H${n(right - r)}`,
    `A${r} ${r} 0 0 1 ${n(right)} ${n(top + r)}`,
    `V${n(bottom - r)}`,
    `A${r} ${r} 0 0 1 ${n(right - r)} ${n(bottom)}`,
    `H${n(tailEnd)}`,
    `L${n(tip.x)} ${n(tip.y)}`,
    `L${n(tailStart)} ${n(bottom)}`,
    `H${n(left + r)}`,
    `A${r} ${r} 0 0 1 ${n(left)} ${n(bottom - r)}`,
    `V${n(top + r)}`,
    `A${r} ${r} 0 0 1 ${n(left + r)} ${n(top)}`,
    "Z",
  ].join("");
}
