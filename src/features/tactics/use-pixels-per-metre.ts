"use client";

/**
 * How many CSS pixels a pitch metre takes on screen in a board's SVG, kept up
 * to date as the SVG resizes, so a label can stay readable however small the
 * board is drawn. The SVG fits its view box inside its box (the default
 * `xMidYMid meet`), so the tighter of the two directions sets the scale. 0
 * until the board is laid out, and where there is no `ResizeObserver`.
 */
import { useEffect, useState, type RefObject } from "react";

export function usePixelsPerMetre(
  svgRef: RefObject<SVGSVGElement | null>,
  view: { readonly width: number; readonly height: number },
): number {
  const [scale, setScale] = useState(0);
  const { width, height } = view;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const box = svg.getBoundingClientRect();
      setScale(Math.min(box.width / width, box.height / height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [svgRef, width, height]);

  return scale;
}
