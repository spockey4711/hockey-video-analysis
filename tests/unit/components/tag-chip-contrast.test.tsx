import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TagChip, type TagChipType } from "@/components/data/TagChip";

afterEach(cleanup);

/**
 * WCAG AA guard for every tag chip (P2-8 audit G13). The chip labels are
 * micro/caption caps, far below the large-text scale, so every pair must clear
 * 4.5:1. The colors are read from the shipped token file and the classes from
 * the rendered chip, so a retuned hue, a new chip type or a changed tint fails
 * here instead of in a browser.
 */
const AA = 4.5;
const CHIP_TYPES: readonly TagChipType[] = [
  "goal",
  "corner_short",
  "action_good",
  "action_bad",
  "whistle",
];
/** Every workspace surface a chip can sit on (rows, panels, hover and inset wells). */
const SURFACES = [
  "--bg-app",
  "--bg-base",
  "--surface",
  "--surface-raised",
  "--surface-hover",
  "--surface-inset",
];

type Theme = "dark" | "light";
type Rgb = [number, number, number];

const css = readFileSync(
  join(process.cwd(), "src", "styles", "tokens", "colors.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

function declarations(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in colors.css`);
  const block = css.slice(start, css.indexOf("\n}", start));
  const decls = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    decls.set(name!, value!.trim());
  }
  return decls;
}

const darkDecls = declarations(":root");
const themes: Record<Theme, Map<string, string>> = {
  dark: darkDecls,
  light: new Map([...darkDecls, ...declarations(':root[data-theme="light"]')]),
};

/** Resolve a token to an sRGB triple (0-1), following `var()` aliases. */
function resolve(theme: Theme, token: string): Rgb {
  const value = themes[theme].get(token);
  if (value === undefined) throw new Error(`${token} is not declared`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  if (alias) return resolve(theme, alias[1]!);
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (!hex) throw new Error(`${token} is not a hex color or alias: ${value}`);
  return [0, 2, 4].map(
    (i) => parseInt(hex[1]!.slice(i, i + 2), 16) / 255,
  ) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** A fill at `alpha` composited over an opaque surface, as the browser paints it. */
function over(fill: Rgb, alpha: number, surface: Rgb): Rgb {
  return fill.map((c, i) => c * alpha + surface[i]! * (1 - alpha)) as Rgb;
}

function chipClasses(type: TagChipType, solid: boolean): string {
  render(<TagChip type={type} solid={solid} data-testid="chip" />);
  const className = screen.getByTestId("chip").className;
  cleanup();
  return className;
}

function token(className: string, pattern: RegExp): RegExpExecArray {
  const match = pattern.exec(className);
  if (!match) throw new Error(`no ${pattern} in "${className}"`);
  return match;
}

describe.each<Theme>(["dark", "light"])("tag chip contrast (%s)", (theme) => {
  it.each(CHIP_TYPES)("soft %s text clears AA on every surface", (type) => {
    const classes = chipClasses(type, false);
    const text = token(classes, /text-\[color:var\((--[\w-]+)\)\]/)[1]!;
    const [, fill, percent] = token(
      classes,
      /bg-\[color-mix\(in_oklab,var\((--[\w-]+)\)_(\d+)%,transparent\)\]/,
    );
    const failures = SURFACES.flatMap((surface) => {
      const bg = over(
        resolve(theme, fill!),
        Number(percent) / 100,
        resolve(theme, surface),
      );
      const ratio = contrast(resolve(theme, text), bg);
      return ratio < AA ? [`${text} on ${surface}: ${ratio.toFixed(2)}`] : [];
    });
    expect(failures).toEqual([]);
  });

  it.each(CHIP_TYPES)("solid %s ink clears AA on its fill", (type) => {
    const classes = chipClasses(type, true);
    const ink = token(classes, /text-\[color:var\((--[\w-]+)\)\]/)[1]!;
    const fill = token(classes, /bg-\[var\((--[\w-]+)\)\]/)[1]!;
    expect(
      contrast(resolve(theme, ink), resolve(theme, fill)),
    ).toBeGreaterThanOrEqual(AA);
  });
});
