"use client";

import { type KeyboardEvent, type PointerEvent, useRef } from "react";

import { clipEditorContent } from "./content";
import {
  centreRectOn,
  isFullPicture,
  moveRect,
  oppositeCorner,
  rectFromCorners,
  scaleRect,
} from "./zoom";

import type { ZoomRect } from "@/features/clip-edits";
import type { PicturePoint } from "@/features/player/telestration/geometry";

const { zoom: copy } = clipEditorContent;

/** A press that moves less than this many pixels is a click, not a drag. */
const DRAG_PX = 4;
/** How far an arrow key moves the frame, as a fraction of the picture; Shift moves further. */
const KEY_MOVE = 0.01;
const KEY_MOVE_LARGE = 0.05;
/** How much one + or - press zooms. */
const KEY_ZOOM = 1.1;

interface Corner {
  readonly right: boolean;
  readonly down: boolean;
}

const CORNERS: readonly Corner[] = [
  { right: false, down: false },
  { right: true, down: false },
  { right: false, down: true },
  { right: true, down: true },
];

/** What the pointer holding the frame is doing. */
type Drag =
  | {
      readonly mode: "draw";
      readonly pointerId: number;
      readonly anchor: PicturePoint;
      readonly fromX: number;
      readonly fromY: number;
      moved: boolean;
    }
  | {
      readonly mode: "move";
      readonly pointerId: number;
      readonly offset: PicturePoint;
    }
  | {
      readonly mode: "resize";
      readonly pointerId: number;
      readonly anchor: PicturePoint;
    };

export interface ZoomFrameHandleProps {
  /** The crop being set, in picture space. */
  readonly rect: ZoomRect;
  readonly onChange: (rect: ZoomRect) => void;
}

/**
 * The zoom crop as a frame on the whole picture (ADR 0011), laid exactly over
 * the video frame by the stage: the part outside it is dimmed, as it will be
 * cut away. Drag the frame to move it, a corner to resize it (it keeps the
 * picture's shape), or across the picture to draw a new one; a click on the
 * picture centres the frame there. With the frame focused, the arrow keys move
 * it and + and - zoom in and out.
 */
export function ZoomFrameHandle({ rect, onChange }: ZoomFrameHandleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  function pointAt(event: PointerEvent): PicturePoint {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
    const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
    return {
      x: clamp01((event.clientX - box.left) / box.width),
      y: clamp01((event.clientY - box.top) / box.height),
    };
  }

  function hold(event: PointerEvent, next: Drag) {
    event.stopPropagation();
    rootRef.current?.setPointerCapture(event.pointerId);
    drag.current = next;
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    const point = pointAt(event);
    switch (current.mode) {
      case "draw":
        current.moved ||=
          Math.hypot(
            event.clientX - current.fromX,
            event.clientY - current.fromY,
          ) > DRAG_PX;
        if (current.moved) onChange(rectFromCorners(current.anchor, point));
        break;
      case "move":
        onChange(
          moveRect(
            rect,
            point.x - current.offset.x - rect.x,
            point.y - current.offset.y - rect.y,
          ),
        );
        break;
      case "resize":
        onChange(rectFromCorners(current.anchor, point));
        break;
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (current.mode === "draw" && !current.moved) {
      onChange(centreRectOn(rect, pointAt(event)));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? KEY_MOVE_LARGE : KEY_MOVE;
    let next: ZoomRect;
    switch (event.key) {
      case "ArrowLeft":
        next = moveRect(rect, -step, 0);
        break;
      case "ArrowRight":
        next = moveRect(rect, step, 0);
        break;
      case "ArrowUp":
        next = moveRect(rect, 0, -step);
        break;
      case "ArrowDown":
        next = moveRect(rect, 0, step);
        break;
      case "+":
      case "=":
        next = scaleRect(rect, 1 / KEY_ZOOM);
        break;
      case "-":
        next = scaleRect(rect, KEY_ZOOM);
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(next);
  }

  const percent = (fraction: number) => `${(fraction * 100).toFixed(3)}%`;
  return (
    <div
      ref={rootRef}
      data-testid="zoom-frame-area"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        hold(event, {
          mode: "draw",
          pointerId: event.pointerId,
          anchor: pointAt(event),
          fromX: event.clientX,
          fromY: event.clientY,
          moved: false,
        });
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
      }}
      className="absolute inset-0 cursor-crosshair touch-none"
    >
      <div
        role="group"
        tabIndex={0}
        aria-label={copy.frame(rect.w)}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          // The whole picture leaves nothing to move: a drag on it draws.
          if (event.button !== 0 || isFullPicture(rect)) return;
          const point = pointAt(event);
          hold(event, {
            mode: "move",
            pointerId: event.pointerId,
            offset: { x: point.x - rect.x, y: point.y - rect.y },
          });
        }}
        className="absolute cursor-move border-2 border-[color:var(--accent)] shadow-[0_0_0_100vmax_var(--video-scrim)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--video-ink)]"
        style={{
          left: percent(rect.x),
          top: percent(rect.y),
          width: percent(rect.w),
          height: percent(rect.w),
        }}
      >
        {CORNERS.map((corner) => (
          <div
            key={`${corner.right}-${corner.down}`}
            aria-hidden
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              hold(event, {
                mode: "resize",
                pointerId: event.pointerId,
                anchor: oppositeCorner(rect, corner),
              });
            }}
            className="absolute size-[var(--space-4)] rounded-[var(--radius-xs)] border-2 border-[color:var(--video-ink)] bg-[var(--accent)]"
            style={{
              left: corner.right ? "100%" : 0,
              top: corner.down ? "100%" : 0,
              // Inside the frame, so a whole-picture frame keeps its corners.
              transform: `translate(${corner.right ? "-100%" : "0"}, ${corner.down ? "-100%" : "0"})`,
              cursor:
                corner.right === corner.down ? "nwse-resize" : "nesw-resize",
            }}
          />
        ))}
      </div>
    </div>
  );
}
