"use client";

/**
 * The stage's markers (ADR 0011, D6): the coach's strokes drawn over the
 * picture while they show - a running marker for its hold time, a freezing
 * one while the picture holds for it or stands on its frame.
 *
 * The canvas lies on the picture frame, unzoomed, so strokes are painted at
 * screen resolution and stay crisp at any zoom. Each stroke is mapped through
 * the crop shown at the playhead, so it sticks to the pitch while the picture
 * zooms, and pens are sized for the frame on screen rather than the enlarged
 * picture, so a zoom does not fatten the lines. Read-only: drawing happens in
 * the editor's telestration layer. Redrawn on playhead moves outside React,
 * like the zoom itself, and only when what shows changes.
 */
import { useEffect, useRef } from "react";

import type { ZoomRect } from "../edit";
import { marksShownAt, zoomAt, type PlaybackPlan } from "../playback";

import type { LiveValue, Playhead } from "./use-edited-playback";

import { viewRect } from "@/features/player/telestration/geometry";
import {
  drawStrokes,
  readDrawPalette,
  type DrawPalette,
} from "@/features/player/telestration/render";

export interface MarksOverlayProps {
  readonly plan: PlaybackPlan;
  readonly playhead: Playhead;
  /** The freezing marker the picture holds for, if any. */
  readonly held: LiveValue<string | null>;
  /** The crop shown instead of the plan's, as the stage's own override. */
  readonly zoom?: ZoomRect;
}

export function MarksOverlay({
  plan,
  playhead,
  held,
  zoom,
}: MarksOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let palette: DrawPalette | null = null;
    let width = 0;
    let height = 0;
    let scale = 1;
    // What the canvas shows now, to skip frames that change nothing.
    let drawn = "";

    const draw = (force: boolean) => {
      const t = playhead.get();
      const shown = marksShownAt(plan, t, held.get());
      const view = zoom ?? zoomAt(plan.zoom, t);
      const key =
        shown.length === 0
          ? ""
          : `${shown.map((mark) => mark.id).join()}|${view.x},${view.y},${view.w}`;
      if (!force && key === drawn) return;
      drawn = key;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (shown.length === 0) return;
      palette ??= readDrawPalette(canvas);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawStrokes(
        ctx,
        shown.flatMap((mark) => mark.strokes),
        viewRect({ x: 0, y: 0, width, height }, view),
        palette,
        width,
      );
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      // Back the canvas at device resolution so strokes stay crisp on HiDPI.
      scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      draw(true);
    };

    resize();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    const offPlayhead = playhead.subscribe(() => draw(false));
    const offHeld = held.subscribe(() => draw(false));
    return () => {
      observer?.disconnect();
      offPlayhead();
      offHeld();
    };
  }, [plan, playhead, held, zoom]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="marks-overlay"
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
