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
 */
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
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
import { drawStrokes, readDrawPalette } from "./render";
import type { TelestrationAction, TelestrationState } from "./state";

export interface TelestrationLayerProps {
  readonly state: TelestrationState;
  readonly dispatch: Dispatch<TelestrationAction>;
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
    if (event.button !== 0 || drawingPointer.current !== null) return;
    drawingPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch({ type: "begin", point: pointAt(event) });
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>): void {
    if (drawingPointer.current !== event.pointerId) return;
    dispatch({ type: "extend", point: pointAt(event) });
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>): void {
    if (drawingPointer.current !== event.pointerId) return;
    drawingPointer.current = null;
    dispatch({ type: "extend", point: pointAt(event) });
    dispatch({ type: "end" });
  }

  function onPointerCancel(event: PointerEvent<HTMLCanvasElement>): void {
    if (drawingPointer.current !== event.pointerId) return;
    drawingPointer.current = null;
    dispatch({ type: "cancel" });
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={telestrationContent.canvas}
      // touch-none keeps a finger drag drawing instead of scrolling the page.
      className="absolute inset-0 size-full cursor-crosshair touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}
