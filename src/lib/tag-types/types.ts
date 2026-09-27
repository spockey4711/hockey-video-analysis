/**
 * A tag's set of types (ADR 0016). A tag keeps its main type - the one it was
 * captured as, which chose its window and colours its marker - and may carry
 * further types the same moment also counts as: a short corner that ended in a
 * goal is one tag and one clip. The further types are stored in the config's
 * order, never repeat and never hold the main type; the helpers here are the
 * one place that keeps them so. Pure, so they are unit-tested directly and
 * shared by the validators, the queries and the edit form.
 */
import { TAG_TYPES } from "./config";

/** What a tag says about its types: the main type and the further ones. */
export interface TagTypes {
  readonly type: string;
  readonly extraTypes: readonly string[];
}

const ORDER = new Map<string, number>(
  TAG_TYPES.map((def, index) => [def.key, index]),
);

/** Order keys as the config lists them; unknown keys go last, as given. */
function byConfigOrder(a: string, b: string): number {
  return (ORDER.get(a) ?? ORDER.size) - (ORDER.get(b) ?? ORDER.size);
}

/** A tag's types, the main type first: what every "is this a goal" asks. */
export function tagTypeKeys(tag: TagTypes): string[] {
  return [tag.type, ...tag.extraTypes];
}

const LABELS = new Map<string, string>(
  TAG_TYPES.map((def) => [def.key, def.label]),
);

/**
 * A tag's types as one German title, the main type first ("Ecke kurz + Tor").
 * A key no longer in the config shows as stored, so a title never blanks.
 */
export function tagTypesLabel(tag: TagTypes): string {
  return tagTypeKeys(tag)
    .map((key) => LABELS.get(key) ?? key)
    .join(" + ");
}

/**
 * The further types to store next to `mainType`: without the main type,
 * without repeats, in the config's order.
 */
export function normalizeExtraTypes(
  mainType: string,
  extraTypes: readonly string[],
): string[] {
  return [...new Set(extraTypes)]
    .filter((key) => key !== mainType)
    .sort(byConfigOrder);
}

/**
 * Parse an untrusted list of further types: an array of configured type keys,
 * normalized against `mainType`. `null` when it is not such a list, so an
 * unknown key can never be stored.
 */
export function parseExtraTypes(
  raw: unknown,
  mainType: string,
): string[] | null {
  if (!Array.isArray(raw)) return null;
  const keys: string[] = [];
  for (const value of raw as unknown[]) {
    if (typeof value !== "string" || !ORDER.has(value)) return null;
    keys.push(value);
  }
  return normalizeExtraTypes(mainType, keys);
}

/**
 * The types an edit leaves on a tag from the set of types the coach has
 * switched on. The main type stays while it is on; otherwise the first type
 * that is on in the config's order takes its place. `null` when none is on,
 * since a tag always has a type.
 */
export function tagTypesFromSelection(
  selected: readonly string[],
  mainType: string,
): TagTypes | null {
  const ordered = [...new Set(selected)].sort(byConfigOrder);
  const [first] = ordered;
  if (first === undefined) return null;
  const type = ordered.includes(mainType) ? mainType : first;
  return { type, extraTypes: normalizeExtraTypes(type, ordered) };
}
