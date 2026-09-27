/**
 * The spot tools (M11): a spotlight ring under a player and a magnifier lens
 * pinned to a spot. Both are placed rather than drawn, so a tap works as well as
 * a drag, and the keyboard can place, move and resize them. A spot stroke keeps
 * two points, like a circle: its centre and a point on its rim, so its size
 * holds in picture space on every screen and in the stored edit.
 */
import type { PicturePoint, Rect } from "./geometry";
import type { DrawTool, Stroke } from "./state";

/** The tools that place a ring or a lens around one spot. */
export type SpotTool = "spotlight" | "magnifier";

export const SPOT_TOOLS: readonly SpotTool[] = ["spotlight", "magnifier"];

/** Whether `tool` places a spot rather than drawing a line. */
export function isSpotTool(tool: DrawTool): tool is SpotTool {
  return tool === "spotlight" || tool === "magnifier";
}

/**
 * How tall the spotlight ring is against its width: a circle on the pitch seen
 * from the stand, flattened by the camera's view angle.
 */
export const SPOTLIGHT_TILT = 0.35;

/** How much larger the magnifier shows the picture under it. */
export const MAGNIFIER_ZOOM = 2;

/**
 * The radius a tap places, as a fraction of the picture width: a ring about as
 * wide as a player's stance in a wide shot, and a lens that shows a small group.
 */
export const DEFAULT_SPOT_RADIUS: Readonly<Record<SpotTool, number>> = {
  spotlight: 0.035,
  magnifier: 0.08,
};

/** The smallest and largest radius the keyboard resizes a spot to, in picture widths. */
export const MIN_SPOT_RADIUS = 0.01;
export const MAX_SPOT_RADIUS = 0.4;

/** How far one arrow key moves a spot, and with Shift held, in picture units. */
export const SPOT_STEP = 0.01;
export const SPOT_STEP_LARGE = 0.05;

/** How much `+` grows a spot; `-` shrinks it by the same factor. */
export const SPOT_RESIZE = 1.25;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * The rim point at `offset` from `centre`, mirrored to the other side on an
 * axis where it would leave the picture - so a spot at the very edge keeps its
 * size instead of shrinking against the frame.
 */
function rimAt(centre: PicturePoint, offset: PicturePoint): PicturePoint {
  const along = (at: number, by: number) =>
    at + by >= 0 && at + by <= 1 ? at + by : clamp01(at - by);
  return { x: along(centre.x, offset.x), y: along(centre.y, offset.y) };
}

function offsetOf(stroke: Stroke): PicturePoint {
  const [centre, rim] = stroke.points;
  if (!centre || !rim) return { x: 0, y: 0 };
  return { x: rim.x - centre.x, y: rim.y - centre.y };
}

/** `stroke` with its centre at `centre` and its rim at `offset` from it. */
function placed(
  stroke: Stroke,
  centre: PicturePoint,
  offset: PicturePoint,
): Stroke {
  const at = { x: clamp01(centre.x), y: clamp01(centre.y) };
  return { ...stroke, points: [at, rimAt(at, offset)] };
}

/** How big a spot stroke is, in picture units (0 for a stroke without two points). */
export function spotExtent(stroke: Stroke): number {
  const offset = offsetOf(stroke);
  return Math.hypot(offset.x, offset.y);
}

/**
 * A released spot draft as it is kept: dragged out, it keeps the size of the
 * drag; tapped (a drag too short to be one), it gets the tool's default size
 * around the tapped spot.
 */
export function sizedSpot(stroke: Stroke, minExtent: number): Stroke {
  const [centre] = stroke.points;
  if (!centre || !isSpotTool(stroke.tool)) return stroke;
  if (spotExtent(stroke) >= minExtent) return stroke;
  return placed(stroke, centre, { x: DEFAULT_SPOT_RADIUS[stroke.tool], y: 0 });
}

/** `stroke` moved by `dx`, `dy`, its centre kept on the picture. */
export function movedSpot(stroke: Stroke, dx: number, dy: number): Stroke {
  const [centre] = stroke.points;
  if (!centre) return stroke;
  return placed(
    stroke,
    { x: centre.x + dx, y: centre.y + dy },
    offsetOf(stroke),
  );
}

/**
 * `stroke` grown by `factor` (below 1 shrinks it) around its centre, its
 * radius kept between {@link MIN_SPOT_RADIUS} and {@link MAX_SPOT_RADIUS}.
 */
export function resizedSpot(stroke: Stroke, factor: number): Stroke {
  const [centre] = stroke.points;
  if (!centre) return stroke;
  const offset = offsetOf(stroke);
  const extent = Math.hypot(offset.x, offset.y);
  if (extent === 0) return stroke;
  const next = Math.min(
    Math.max(extent * factor, MIN_SPOT_RADIUS),
    MAX_SPOT_RADIUS,
  );
  const scale = next / extent;
  return placed(stroke, centre, { x: offset.x * scale, y: offset.y * scale });
}

/**
 * A spot's centre and radius in the pixels of `picture`. The radius is the
 * distance from the centre to the rim on screen, so a drag in any direction
 * sets it and a non-square picture does not squash a lens.
 */
export function spotPixels(
  stroke: Stroke,
  picture: Rect,
): { x: number; y: number; radius: number } | null {
  const [centre, rim] = stroke.points;
  if (!centre || !rim) return null;
  return {
    x: picture.x + centre.x * picture.width,
    y: picture.y + centre.y * picture.height,
    radius: Math.hypot(
      (rim.x - centre.x) * picture.width,
      (rim.y - centre.y) * picture.height,
    ),
  };
}
