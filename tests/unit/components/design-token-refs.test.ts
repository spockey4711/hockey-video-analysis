import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guard against references to design tokens that do not exist. A typo such as
 * `var(--fs-heading)` compiles fine, but the browser drops the whole
 * declaration, so the element silently falls back to the inherited value (the
 * P2-8 audit's G2). Every scale token - type size, line-height, tracking,
 * weight, spacing - referenced anywhere in `src/` must be declared in
 * `src/styles/tokens/`.
 */
const SRC = join(process.cwd(), "src");
const TOKENS = join(SRC, "styles", "tokens");
const SCALE_PREFIXES = ["fs", "lh", "ls", "fw", "space"];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

const prefixes = SCALE_PREFIXES.join("|");

function declaredTokens(): Set<string> {
  const declared = new Set<string>();
  for (const file of walk(TOKENS)) {
    const css = readFileSync(file, "utf8");
    for (const match of css.matchAll(
      new RegExp(`(--(?:${prefixes})-[\\w-]+)\\s*:`, "g"),
    )) {
      declared.add(match[1]!);
    }
  }
  return declared;
}

describe("design token references", () => {
  it("only references scale tokens that are declared", () => {
    const declared = declaredTokens();
    expect(declared.size).toBeGreaterThan(0);

    const undefinedRefs: string[] = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        new RegExp(`var\\((--(?:${prefixes})-[\\w-]+)`, "g"),
      )) {
        if (!declared.has(match[1]!)) {
          undefinedRefs.push(`${file.slice(SRC.length + 1)}: ${match[1]}`);
        }
      }
    }

    expect(undefinedRefs).toEqual([]);
  });
});
