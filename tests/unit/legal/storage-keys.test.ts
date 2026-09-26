import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { legalContent } from "@/features/legal/content";

const SRC_ROOT = path.resolve(__dirname, "../../../src");

/** Matches a quoted string literal whose whole value is an `hva-*`/`hva_*` token. */
const STORAGE_KEY_LITERAL = /["'](hva[-_][a-zA-Z0-9_-]*)["']/g;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    if (/\.(ts|tsx)$/.test(entry.name)) return [full];
    return [];
  });
}

/** Every `hva-*`/`hva_*` browser storage key or cookie name declared under `src/`. */
function collectDeclaredKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of collectSourceFiles(SRC_ROOT)) {
    const contents = readFileSync(file, "utf-8");
    for (const match of contents.matchAll(STORAGE_KEY_LITERAL)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function privacyPolicyText(): string {
  const sections = legalContent.privacy.sections(null);
  return sections
    .flatMap((section) => [...section.paragraphs, ...(section.items ?? [])])
    .join("\n");
}

describe("Datenschutz coverage of hva-* storage keys", () => {
  it("lists every hva-*/hva_* storage key or cookie used in src/", () => {
    const declaredKeys = collectDeclaredKeys();
    const policyText = privacyPolicyText();

    const missing = [...declaredKeys].filter(
      (key) => !policyText.includes(key),
    );

    expect(missing).toEqual([]);
  });
});
