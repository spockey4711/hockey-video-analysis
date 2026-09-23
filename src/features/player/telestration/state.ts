/**
 * The telestration drawing model (P2-10) as a pure reducer: which tool and pen
 * are picked, the finished strokes on the current still, and the stroke being
 * dragged out right now. Kept free of React and the DOM so the drawing rules
 * (what a drag makes, what counts as an accidental click, what undo removes) are
 * unit-tested on their own.
 */
import type { PicturePoint } from "./geometry";

/** What a drag draws: a straight arrow, an ellipse around a player, or a free line. */
export type DrawTool = "arrow" | "circle" | "freehand";

export const DRAW_TOOLS: readonly DrawTool[] = ["freehand", "arrow", "circle"];

/** The pen colours on offer, each backed by a `--draw-*` design token. */
export type PenColor = "red" | "yellow" | "blue" | "white";

export const PEN_COLORS: readonly PenColor[] = [
  "red",
  "yellow",
  "blue",
  "white",
];

/** CSS custom-property name holding a pen colour. */
export function penColorVar(color: PenColor): string {
  return `--draw-${color}`;
}

/**
 * One mark on the still. A freehand stroke keeps every sampled point; an arrow
 * or a circle keeps exactly two - where the drag started and where it is now
 * (the arrow's tail and tip, the circle's bounding-box corners).
 */
export interface Stroke {
  readonly tool: DrawTool;
  readonly color: PenColor;
  readonly points: readonly PicturePoint[];
}

export interface TelestrationState {
  /** Whether the drawing layer is up (the video is paused on a still). */
  readonly active: boolean;
  readonly tool: DrawTool;
  readonly color: PenColor;
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
  strokes: [],
  draft: null,
};

/**
 * The smallest extent (in picture units, so about 1% of the frame) an arrow or
 * circle must span to be kept. Anything smaller is a click, not a drawing, and
 * would leave a stray arrowhead or a dot of an ellipse on the still.
 */
export const MIN_SHAPE_EXTENT = 0.01;

function extent(stroke: Stroke): number {
  const [start, end] = [
    stroke.points[0],
    stroke.points[stroke.points.length - 1],
  ];
  if (!start || !end) return 0;
  return Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
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
      // keeps the coach's tool and pen for next time.
      return { ...state, active: false, strokes: [], draft: null };
    case "setTool":
      return { ...state, tool: action.tool };
    case "setColor":
      return { ...state, color: action.color };
    case "begin":
      if (!state.active) return state;
      return {
        ...state,
        draft: {
          tool: state.tool,
          color: state.color,
          points:
            state.tool === "freehand"
              ? [action.point]
              : [action.point, action.point],
        },
      };
    case "extend": {
      const { draft } = state;
      if (!draft) return state;
      const points =
        draft.tool === "freehand"
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
