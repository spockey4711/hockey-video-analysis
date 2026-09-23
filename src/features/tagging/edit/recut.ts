/**
 * Whether a tag edit changes the footage its clip holds. A cut clip is a copy of
 * the tag's window taken when it was cut, so an edit that moves the window must
 * cut the clip again; one that only relabels the tag must not. Pure, so the
 * rule is unit-tested apart from the query that applies it.
 */
import type { TagEditInput } from "./validation";

/** The persisted fields a tag's clip window is resolved from. */
export interface TagWindowFields {
  readonly type: string;
  readonly startS: number;
  readonly endS: number | null;
}

/**
 * True when `after` resolves to a different clip window than `before`. A moved
 * start or end always does. A type change does only while the tag has no
 * explicit end: the end then comes from the type's default follow-through (see
 * `resolveClipEnd`), so a new type means a new end.
 */
export function clipWindowChanged(
  before: TagWindowFields,
  after: TagEditInput,
): boolean {
  if (before.startS !== after.startS || before.endS !== after.endS) {
    return true;
  }
  return after.endS === null && before.type !== after.type;
}
