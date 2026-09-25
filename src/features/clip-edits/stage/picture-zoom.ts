"use client";

/**
 * The stage's zoom (ADR 0011): the crop the plan asks for at the playhead,
 * shown as a CSS transform on the full-resolution picture. The browser scales
 * the decoded video frame itself, so a zoom stays as sharp as the footage
 * allows and costs no re-encode; the picture frame around it clips the rest.
 *
 * The transform is written straight onto the element on every playhead move,
 * so zooming never re-renders the player.
 */
import { type RefObject, useEffect } from "react";

import type { ZoomRect } from "../edit";
import { zoomAt, type PlaybackPlan } from "../playback";

import type { Playhead } from "./use-edited-playback";

/**
 * The transform that fills the picture with `rect`, for an element the size of
 * the picture with its origin at the top left: scale the crop up to the full
 * width, after moving its corner to the origin. The whole picture needs none.
 */
export function zoomTransform(rect: ZoomRect): string {
  if (rect.w >= 1) return "";
  const percent = (fraction: number) =>
    `${Number((-fraction * 100).toFixed(4))}%`;
  return `scale(${Number((1 / rect.w).toFixed(6))}) translate(${percent(rect.x)}, ${percent(rect.y)})`;
}

/**
 * Keep `layerRef`'s transform on the plan's crop at the playhead, or on
 * `override` while one is given (the editor shows the whole picture while a
 * crop is being set).
 */
export function usePictureZoom(
  layerRef: RefObject<HTMLElement | null>,
  plan: PlaybackPlan,
  playhead: Playhead,
  override: ZoomRect | undefined,
): void {
  const { zoom } = plan;
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const apply = () => {
      layer.style.transform = zoomTransform(
        override ?? zoomAt(zoom, playhead.get()),
      );
    };
    apply();
    return playhead.subscribe(apply);
  }, [layerRef, zoom, playhead, override]);
}
