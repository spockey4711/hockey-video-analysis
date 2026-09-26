/**
 * The Tag-Fenster form's rules: which field holds which edge of which type, and
 * how the untrusted values become the team's windows. Pure, so the bounds and
 * the reset are unit-tested without a browser or a database.
 */
import {
  DEFAULT_TAG_WINDOWS,
  TAG_TYPES,
  isWindowPostS,
  isWindowPreS,
  sameTagWindow,
  type TagWindow,
  type TagWindows,
} from "@/lib/tag-types";

/** The form's `intent` value that puts every window back to its default. */
export const RESET_INTENT = "reset";

/** An edge of a window as the form names it. */
export type TagWindowEdge = "preS" | "postS";

/** A field of the form: one edge of one type's window, e.g. `goal.preS`. */
export type TagWindowField = `${string}.${TagWindowEdge}`;

/** The form field that holds `edge` of `type`'s window. */
export function tagWindowField(
  type: string,
  edge: TagWindowEdge,
): TagWindowField {
  return `${type}.${edge}`;
}

/** The raw values of the form, keyed by {@link tagWindowField}. */
export type TagWindowValues = Readonly<Record<TagWindowField, string>>;

/** The form's values for `windows`, one pair per configured type. */
export function tagWindowValues(windows: TagWindows): TagWindowValues {
  const values: Record<TagWindowField, string> = {};
  for (const { key } of TAG_TYPES) {
    const window = windows[key] ?? DEFAULT_TAG_WINDOWS[key];
    values[tagWindowField(key, "preS")] = String(window.preS);
    values[tagWindowField(key, "postS")] = String(window.postS);
  }
  return values;
}

export type TagWindowsParseResult =
  | { readonly ok: true; readonly value: TagWindows }
  | { readonly ok: false; readonly invalid: readonly TagWindowField[] };

function wholeSeconds(raw: string | undefined): number {
  const text = (raw ?? "").trim();
  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * Parse the untrusted form into a window for every configured type. Each edge
 * must be whole seconds inside the team bounds; a missing field is invalid, so
 * a tampered form can never store half a window. Every bad field is reported,
 * so the form marks them all at once.
 */
export function parseTagWindowsInput(
  read: (field: TagWindowField) => string | undefined,
): TagWindowsParseResult {
  const windows: Record<string, TagWindow> = {};
  const invalid: TagWindowField[] = [];
  for (const { key } of TAG_TYPES) {
    const preS = wholeSeconds(read(tagWindowField(key, "preS")));
    const postS = wholeSeconds(read(tagWindowField(key, "postS")));
    if (!isWindowPreS(preS)) invalid.push(tagWindowField(key, "preS"));
    if (!isWindowPostS(postS)) invalid.push(tagWindowField(key, "postS"));
    windows[key] = { preS, postS };
  }
  if (invalid.length > 0) return { ok: false, invalid };
  return { ok: true, value: windows };
}

/**
 * The windows that differ from their type's default: what the team actually
 * set, and so what gets stored. A window put back to its default is dropped,
 * so the type follows the default again should the default ever change.
 */
export function changedTagWindows(
  windows: TagWindows,
): readonly { readonly type: string; readonly window: TagWindow }[] {
  return TAG_TYPES.flatMap(({ key }) => {
    const window = windows[key];
    const fallback = DEFAULT_TAG_WINDOWS[key];
    return window && !sameTagWindow(window, fallback)
      ? [{ type: key, window }]
      : [];
  });
}

/** Whether every type captures with its default window. */
export function isDefaultTagWindows(windows: TagWindows): boolean {
  return changedTagWindows(windows).length === 0;
}
