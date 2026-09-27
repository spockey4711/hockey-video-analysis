"use client";

/**
 * The drawing surface over the paused frame (P2-10): a canvas covering the video
 * stage that turns pointer drags into strokes and paints them live. Pointer
 * positions are mapped into picture space against the letterboxed picture
 * rectangle, so the drawing sticks to the frame whatever the stage size, and a
 * resize (entering fullscreen, say) just repaints the same strokes larger.
 *
 * Over a zoomed picture (a clip edit's zoom, drawn in place on the picture
 * frame) the layer is given the `view` shown: strokes then land on the spot of
 * the whole picture under the pointer, and pens keep their width on screen.
 *
 * While a spot tool (a spotlight or a magnifier) is picked, or a spot was the
 * last thing placed, the layer takes the keyboard: Enter or Space places one in
 * the middle of the view, the arrow keys move the last one placed (Shift for
 * larger steps), `+` and `-` resize it.
 */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { telestrationContent } from "./content";
import {
  containRect,
  toPicturePoint,
  viewRect,
  type PictureView,
  type Rect,
} from "./geometry";
import { drawStrokes, readDrawPalette, videoFrame } from "./render";
import { isSpotTool, SPOT_RESIZE, SPOT_STEP, SPOT_STEP_LARGE } from "./spots";
import {
  initialTelestrationState,
  type Stroke,
  type TelestrationAction,
  type TelestrationState,
} from "./state";

export interface TelestrationLayerProps {
  readonly state: TelestrationState;
  /**
   * Where the layer's drags go. Left out, the layer only shows the strokes
   * and lets every pointer through, as on a presentation's audience window.
   */
  readonly dispatch?: Dispatch<TelestrationAction>;
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  /** The part of the picture shown, when it is zoomed; the whole picture by default. */
  readonly view?: PictureView;
}

interface StageSize {
  readonly width: number;
  readonly height: number;
}

/** Track the canvas's CSS size, so its backing store follows the stage. */
function useElementSize(ref: RefObject<HTMLElement | null>): StageSize {
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (): void => {
      const { width, height } = element.getBoundingClientRect();
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** The picture's rectangle inside the stage, in CSS pixels. */
function pictureRect(stage: StageSize, video: HTMLVideoElement | null): Rect {
  return containRect(
    stage.width,
    stage.height,
    video?.videoWidth ?? 0,
    video?.videoHeight ?? 0,
  );
}

export function TelestrationLayer({
  state,
  dispatch,
  videoRef,
  view,
}: TelestrationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(canvasRef);
  const drawingPointer = useRef<number | null>(null);
  const hintId = useId();

  const { strokes, draft } = state;
  const viewX = view?.x ?? 0;
  const viewY = view?.y ?? 0;
  const viewW = view?.w ?? 1;
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Back the canvas at device resolution so strokes stay crisp on HiDPI.
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * scale);
    canvas.height = Math.round(size.height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    const picture = pictureRect(size, videoRef.current);
    drawStrokes(
      ctx,
      draft ? [...strokes, draft] : strokes,
      viewRect(picture, { x: viewX, y: viewY, w: viewW }),
      readDrawPalette(canvas),
      picture.width,
      videoFrame(videoRef.current),
    );
  }, [strokes, draft, size, videoRef, viewX, viewY, viewW]);

  function pointAt(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return toPicturePoint(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      viewRect(pictureRect(size, videoRef.current), {
        x: viewX,
        y: viewY,
        w: viewW,
      }),
    );
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>): void {
    // Primary button or a touch / pen contact only; one stroke at a time.
    if (!dispatch || event.button !== 0 || drawingPointer.current !== null) {
      return;
    }
    drawingPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch({ type: "begin", point: pointAt(event) });
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>): void {
    if (!dispatch || drawingPointer.current !== event.pointerId) return;
    dispatch({ type: "extend", point: pointAt(event) });
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>): void {
    if (!dispatch || drawingPointer.current !== event.pointerId) return;
    drawingPointer.current = null;
    dispatch({ type: "extend", point: pointAt(event) });
    dispatch({ type: "end" });
  }

  function onPointerCancel(event: PointerEvent<HTMLCanvasElement>): void {
    if (!dispatch || drawingPointer.current !== event.pointerId) return;
    drawingPointer.current = null;
    dispatch({ type: "cancel" });
  }

  const last = strokes[strokes.length - 1];
  const lastIsSpot = !draft && last !== undefined && isSpotTool(last.tool);
  // The keyboard has work only for a spot: placing one, or fixing the last.
  const takesKeys =
    dispatch !== undefined && (isSpotTool(state.tool) || lastIsSpot);

  function onKeyDown(event: KeyboardEvent<HTMLCanvasElement>): void {
    if (!takesKeys || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? SPOT_STEP_LARGE : SPOT_STEP;
    let action: TelestrationAction | null = null;
    switch (event.key) {
      case "Enter":
      case " ":
        if (isSpotTool(state.tool) && !draft) {
          action = {
            type: "place",
            point: { x: viewX + viewW / 2, y: viewY + viewW / 2 },
          };
        }
        break;
      case "ArrowLeft":
        if (lastIsSpot) action = { type: "moveSpot", dx: -step, dy: 0 };
        break;
      case "ArrowRight":
        if (lastIsSpot) action = { type: "moveSpot", dx: step, dy: 0 };
        break;
      case "ArrowUp":
        if (lastIsSpot) action = { type: "moveSpot", dx: 0, dy: -step };
        break;
      case "ArrowDown":
        if (lastIsSpot) action = { type: "moveSpot", dx: 0, dy: step };
        break;
      case "+":
      case "=":
        if (lastIsSpot) action = { type: "resizeSpot", factor: SPOT_RESIZE };
        break;
      case "-":
        if (lastIsSpot) {
          action = { type: "resizeSpot", factor: 1 / SPOT_RESIZE };
        }
        break;
    }
    if (!action) return;
    event.preventDefault();
    dispatch?.(action);
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={telestrationContent.canvas}
        aria-describedby={takesKeys ? hintId : undefined}
        tabIndex={takesKeys ? 0 : undefined}
        // touch-none keeps a finger drag drawing instead of scrolling the page;
        // a layer that only shows lets every pointer through.
        className={
          dispatch
            ? "absolute inset-0 size-full cursor-crosshair touch-none focus-visible:shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--video-ink)]"
            : "pointer-events-none absolute inset-0 size-full"
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
      />
      {takesKeys ? (
        <span id={hintId} className="sr-only">
          {telestrationContent.spotKeys}
        </span>
      ) : null}
    </>
  );
}

export interface TelestrationViewProps {
  readonly strokes: readonly Stroke[];
  readonly videoRef: RefObject<HTMLVideoElement | null>;
}

/**
 * A drawing shown rather than drawn on: the strokes over the picture of
 * `videoRef`, placed on the frame exactly as the layer places them, with every
 * pointer let through (a presentation's audience window).
 */
export function TelestrationView({ strokes, videoRef }: TelestrationViewProps) {
  const state = useMemo(
    () => ({ ...initialTelestrationState, active: true, strokes }),
    [strokes],
  );
  return <TelestrationLayer state={state} videoRef={videoRef} />;
}
