"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface LaserPointerProps {
  /** The element the pointer follows the mouse or finger over (the video area). */
  readonly surfaceRef: RefObject<HTMLElement | null>;
}

/**
 * A laser-pointer dot for presentation mode: a bright, softly glowing spot that
 * follows the mouse or a finger over the video, whether the clip plays or
 * stands still. It draws nothing permanent and never takes a click - the dot
 * ignores pointer events, and it listens on the surface without capturing, so
 * the video and every control underneath keep working.
 *
 * Moves are cheap: a pointer event only records the latest position, and one
 * `requestAnimationFrame` per frame reads the surface's box and writes a single
 * `transform` on the dot. React never re-renders on a move, and the video's
 * layout is never touched.
 */
export function LaserPointer({ surfaceRef }: LaserPointerProps) {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    const dot = dotRef.current;
    if (!surface || !dot) return;
    // Narrowed copies for the closures below.
    const area: HTMLElement = surface;
    const spot: HTMLDivElement = dot;

    let frame = 0;
    let x = 0;
    let y = 0;
    let visible = false;

    function paint() {
      frame = 0;
      const box = area.getBoundingClientRect();
      spot.style.transform = `translate3d(${x - box.left}px, ${y - box.top}px, 0)`;
      spot.style.opacity = visible ? "1" : "0";
    }

    function schedule() {
      if (frame === 0) frame = requestAnimationFrame(paint);
    }

    function show(event: PointerEvent) {
      x = event.clientX;
      y = event.clientY;
      visible = true;
      schedule();
    }

    function hide() {
      visible = false;
      schedule();
    }

    // A finger has no hover: the dot shows while it touches and goes on lift.
    function lift(event: PointerEvent) {
      if (event.pointerType !== "mouse") hide();
    }

    surface.addEventListener("pointermove", show);
    surface.addEventListener("pointerdown", show);
    surface.addEventListener("pointerup", lift);
    surface.addEventListener("pointercancel", hide);
    surface.addEventListener("pointerleave", hide);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      surface.removeEventListener("pointermove", show);
      surface.removeEventListener("pointerdown", show);
      surface.removeEventListener("pointerup", lift);
      surface.removeEventListener("pointercancel", hide);
      surface.removeEventListener("pointerleave", hide);
    };
  }, [surfaceRef]);

  return (
    <div
      aria-hidden="true"
      data-testid="laser-pointer"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        ref={dotRef}
        className="absolute top-0 left-0 opacity-0 transition-opacity duration-[var(--dur-fast)] will-change-transform"
      >
        <div className="size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--laser-core)_35%,var(--laser-glow)_75%)] shadow-[0_0_8px_3px_var(--laser-glow),0_0_28px_12px_var(--laser-halo)]" />
      </div>
    </div>
  );
}
