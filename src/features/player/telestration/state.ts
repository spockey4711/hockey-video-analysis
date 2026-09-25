/**
 * The telestration drawing model (P2-10) as a pure reducer: which tool and pen
 * are picked, the finished strokes on the current still, and the stroke being
 * dragged out right now. Kept free of React and the DOM so the drawing rules
 * (what a drag makes, what counts as an accidental click, what undo removes) are
 * unit-tested on their own.
 */
import type { PicturePoint } from "./geometry";

/**
 * What a drag draws: a straight arrow, a curved arrow (the path of a Schlenzer,
 * bent the way the drag bulges), an ellipse around a player, or a free line.
 */
export type DrawTool = "arrow" | "curve" | "circle" | "freehand";

export const DRAW_TOOLS: readonly DrawTool[] = [
  "freehand",
  "arrow",
  "curve",
  "circle",
];

/** The pen colours on offer, each backed by a `--draw-*` design token. */
export type PenColor = "red" | "yellow" | "blue" | "white";

export const PEN_COLORS: readonly PenColor[] = [
  "red",
  "yellow",
  "blue",
  "white",
];

/**
 * How thick a new stroke is drawn. Each stroke keeps the width it was drawn
 * with, so changing it only affects what comes next.
 */
export type StrokeWidth = "thin" | "medium" | "thick";

/** The width steps, thinnest first - the order the toolbar and the `w` key walk. */
export const STROKE_WIDTHS: readonly StrokeWidth[] = [
  "thin",
  "medium",
  "thick",
];

/** The width step after `width`, wrapping from the thickest back to the thinnest. */
export function nextStrokeWidth(width: StrokeWidth): StrokeWidth {
  const index = STROKE_WIDTHS.indexOf(width);
  return STROKE_WIDTHS[(index + 1) % STROKE_WIDTHS.length] ?? "medium";
}

/** Whether an untrusted value (a stored preference, say) names a width step. */
export function isStrokeWidth(value: unknown): value is StrokeWidth {
  return STROKE_WIDTHS.some((width) => width === value);
}

/**
 * Whether a new stroke is drawn as a solid or a dotted line - a dotted arrow
 * reads as a pass or the ball's path next to a solid run. Like the width, each
 * stroke keeps the style it was drawn with.
 */
export type LineStyle = "solid" | "dotted";

/** The other line style: the toolbar toggle and the `o` key flip between them. */
export function toggledLineStyle(style: LineStyle): LineStyle {
  return style === "solid" ? "dotted" : "solid";
}

/** CSS custom-property name holding a pen colour. */
export function penColorVar(color: PenColor): string {
  return `--draw-${color}`;
}

/**
 * One mark on the still. A freehand line and a curved arrow keep every sampled
 * point (the curve is bent through them, see `curveThrough`); an arrow or a
 * circle keeps exactly two - where the drag started and where it is now (the
 * arrow's tail and tip, the circle's bounding-box corners).
 */
export interface Stroke {
  readonly tool: DrawTool;
  readonly color: PenColor;
  readonly width: StrokeWidth;
  readonly style: LineStyle;
  readonly points: readonly PicturePoint[];
}

export interface TelestrationState {
  /** Whether the drawing layer is up (the video is paused on a still). */
  readonly active: boolean;
  readonly tool: DrawTool;
  readonly color: PenColor;
  /** The width the next stroke is drawn with. */
  readonly width: StrokeWidth;
  /** The line style the next stroke is drawn with. */
  readonly lineStyle: LineStyle;
  /** Finished strokes, oldest first - undo pops the last one. */
  readonly strokes: readonly Stroke[];
  /** The stroke under the pointer, not yet committed. */
  readonly draft: Stroke | null;
}

export type TelestrationAction =
  | { readonly type: "open" }
  | { readonly type: "close" }
  | { readonly type: "setTool"; readonly tool: DrawTool }
  | { readonly type: "setColor"; readonly color: PenColor }
  | { readonly type: "setWidth"; readonly width: StrokeWidth }
  | { readonly type: "cycleWidth" }
  | { readonly type: "setLineStyle"; readonly lineStyle: LineStyle }
  | { readonly type: "toggleLineStyle" }
  | { readonly type: "begin"; readonly point: PicturePoint }
  | { readonly type: "extend"; readonly point: PicturePoint }
  | { readonly type: "end" }
  | { readonly type: "cancel" }
  | { readonly type: "undo" }
  | { readonly type: "clear" };

export const initialTelestrationState: TelestrationState = {
  active: false,
  tool: "arrow",
  color: "red",
  width: "medium",
  lineStyle: "solid",
  strokes: [],
  draft: null,
};

/**
 * The smallest extent (in picture units, so about 1% of the frame) an arrow or
 * circle must span to be kept. Anything smaller is a click, not a drawing, and
 * would leave a stray arrowhead or a dot of an ellipse on the still.
 */
export const MIN_SHAPE_EXTENT = 0.01;

/**
 * How far a stroke reaches: from start to end for an arrow or a circle, and
 * across every sampled point for a curve, whose drag may loop back near where
 * it began.
 */
function extent(stroke: Stroke): number {
  const [start, end] = [
    stroke.points[0],
    stroke.points[stroke.points.length - 1],
  ];
  if (!start || !end) return 0;
  const points = stroke.tool === "curve" ? stroke.points : [start, end];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
}

/** Whether a tool keeps every sampled point of a drag, not just its two ends. */
function keepsPath(tool: DrawTool): boolean {
  return tool === "freehand" || tool === "curve";
}

/** Whether a released draft is worth keeping. A freehand click leaves a dot on purpose. */
export function isKeptStroke(stroke: Stroke): boolean {
  if (stroke.tool === "freehand") return stroke.points.length > 0;
  return extent(stroke) >= MIN_SHAPE_EXTENT;
}

export function telestrationReducer(
  state: TelestrationState,
  action: TelestrationAction,
): TelestrationState {
  switch (action.type) {
    case "open":
      return state.active ? state : { ...state, active: true };
    case "close":
      // The drawing belongs to one frame; leaving it discards the drawing but
      // keeps the coach's tool, pen, width and line style for next time.
      return { ...state, active: false, strokes: [], draft: null };
    case "setTool":
      return { ...state, tool: action.tool };
    case "setColor":
      return { ...state, color: action.color };
    case "setWidth":
      return { ...state, width: action.width };
    case "cycleWidth":
      return { ...state, width: nextStrokeWidth(state.width) };
    case "setLineStyle":
      return { ...state, lineStyle: action.lineStyle };
    case "toggleLineStyle":
      return { ...state, lineStyle: toggledLineStyle(state.lineStyle) };
    case "begin":
      if (!state.active) return state;
      return {
        ...state,
        draft: {
          tool: state.tool,
          color: state.color,
          width: state.width,
          style: state.lineStyle,
          points: keepsPath(state.tool)
            ? [action.point]
            : [action.point, action.point],
        },
      };
    case "extend": {
      const { draft } = state;
      if (!draft) return state;
      const points = keepsPath(draft.tool)
        ? [...draft.points, action.point]
        : [draft.points[0] ?? action.point, action.point];
      return { ...state, draft: { ...draft, points } };
    }
    case "end": {
      const { draft } = state;
      if (!draft) return state;
      return {
        ...state,
        draft: null,
        strokes: isKeptStroke(draft)
          ? [...state.strokes, draft]
          : state.strokes,
      };
    }
    case "cancel":
      return state.draft ? { ...state, draft: null } : state;
    case "undo":
      if (state.draft) return { ...state, draft: null };
      return state.strokes.length > 0
        ? { ...state, strokes: state.strokes.slice(0, -1) }
        : state;
    case "clear":
      return { ...state, strokes: [], draft: null };
  }
}
