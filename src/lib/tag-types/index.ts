/**
 * Public surface of the configurable tag-type module (P1-3). The tagging UI and
 * API (P0-6) resolve `tags.type` keys and hotkeys through these helpers instead
 * of hard-coding the type set, so retuning a type is a one-file config change.
 */
import { TAG_TYPES, type TagTypeDef } from "./config";

/**
 * Fails loudly at module load if the config is internally inconsistent - the
 * kind of mistake a future edit to `config.ts` could introduce. A duplicate key
 * would silently shadow a type, a duplicate or multi-character hotkey would make
 * capture ambiguous, and a non-positive window would cut an empty clip.
 */
function assertConfigValid(defs: readonly TagTypeDef[]): void {
  if (defs.length === 0) {
    throw new Error("tag-type config must define at least one type");
  }
  const keys = new Set<string>();
  const hotkeys = new Set<string>();
  for (const def of defs) {
    if (keys.has(def.key)) {
      throw new Error(`duplicate tag-type key "${def.key}"`);
    }
    keys.add(def.key);

    const hotkey = def.hotkey.toLowerCase();
    if (hotkey.length !== 1) {
      throw new Error(
        `tag-type "${def.key}" hotkey must be a single character`,
      );
    }
    if (hotkeys.has(hotkey)) {
      throw new Error(`duplicate tag-type hotkey "${hotkey}"`);
    }
    hotkeys.add(hotkey);

    const { preS, postS } = def.window;
    if (!Number.isFinite(preS) || preS < 0) {
      throw new Error(
        `tag-type "${def.key}" has an invalid pre-window ${preS}`,
      );
    }
    if (!Number.isFinite(postS) || postS <= 0) {
      throw new Error(
        `tag-type "${def.key}" has an invalid post-window ${postS}`,
      );
    }
  }
}

assertConfigValid(TAG_TYPES);

const BY_KEY = new Map<string, TagTypeDef>(
  TAG_TYPES.map((def) => [def.key, def]),
);
const BY_HOTKEY = new Map<string, TagTypeDef>(
  TAG_TYPES.map((def) => [def.hotkey.toLowerCase(), def]),
);

/** Resolve a `tags.type` key to its definition, or `undefined` if unknown. */
export function getTagType(key: string): TagTypeDef | undefined {
  return BY_KEY.get(key);
}

/** Whether `key` is a configured tag-type key (a valid value for `tags.type`). */
export function isTagTypeKey(key: string): boolean {
  return BY_KEY.has(key);
}

/**
 * Resolve a pressed key to the tag type it captures, or `undefined` if the key
 * is not bound. Matching is case-insensitive.
 */
export function tagTypeForHotkey(key: string): TagTypeDef | undefined {
  return BY_HOTKEY.get(key.toLowerCase());
}

export { TAG_TYPES };
export type { TagTypeDef, TagTone, TagWindow } from "./config";

/** Literal union of the configured `tags.type` keys (e.g. `"goal"`). */
export type TagTypeKey = (typeof TAG_TYPES)[number]["key"];
