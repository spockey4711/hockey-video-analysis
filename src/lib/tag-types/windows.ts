/**
 * Effective tag windows: each tag type's clip window as the team set it
 * (Einstellungen > Tag-Fenster), or the type's default from `config.ts` when
 * the team left it alone. Only a new capture reads these - a tag stores its own
 * start and end, so changing a window never moves an existing tag. Pure and
 * framework-free, so the bounds and the resolution are unit-tested directly and
 * shared by the settings form, the capture path and the cut fallback.
 */
import { TAG_TYPES, type TagTypeDef, type TagWindow } from "./config";

/** Each configured type's window, keyed by `TagTypeDef.key`. */
export type TagWindows = Readonly<Record<string, TagWindow>>;

/** The built-in windows: every type's default from the config. */
export const DEFAULT_TAG_WINDOWS: TagWindows = Object.freeze(
  Object.fromEntries(
    TAG_TYPES.map((type) => [
      type.key,
      { preS: type.window.preS, postS: type.window.postS },
    ]),
  ),
);

/**
 * The bounds a team window must keep, in whole seconds. A lead-in may be 0 (the
 * clip starts at the capture), but the follow-through must be at least a second
 * so a capture never cuts an empty clip; a minute either way is far past any
 * build-up a coach wants in one clip.
 */
export const MIN_PRE_S = 0;
export const MAX_PRE_S = 60;
export const MIN_POST_S = 1;
export const MAX_POST_S = 60;

function isWholeBetween(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

/** Whether `window` is a clip window a team may set. */
export function isTagWindow(window: {
  readonly preS: unknown;
  readonly postS: unknown;
}): window is TagWindow {
  return (
    isWholeBetween(window.preS, MIN_PRE_S, MAX_PRE_S) &&
    isWholeBetween(window.postS, MIN_POST_S, MAX_POST_S)
  );
}

/** Whether two windows are the same. */
export function sameTagWindow(a: TagWindow, b: TagWindow): boolean {
  return a.preS === b.preS && a.postS === b.postS;
}

/** One team window as stored: the type it replaces the default of. */
export interface StoredTagWindow extends TagWindow {
  readonly type: string;
}

/**
 * The windows the team captures with: each stored window that belongs to a
 * configured type and keeps the bounds replaces that type's default. A row for a
 * retired type or outside the bounds (only possible by hand in the database) is
 * ignored, so capture never runs on a nonsense window.
 */
export function resolveTagWindows(
  stored: readonly StoredTagWindow[],
): TagWindows {
  const windows: Record<string, TagWindow> = { ...DEFAULT_TAG_WINDOWS };
  for (const row of stored) {
    if (!Object.hasOwn(DEFAULT_TAG_WINDOWS, row.type) || !isTagWindow(row)) {
      continue;
    }
    windows[row.type] = { preS: row.preS, postS: row.postS };
  }
  return Object.freeze(windows);
}

/**
 * A type with its effective window, for the capture rule. A type the windows do
 * not list keeps its own default.
 */
export function withTagWindow<T extends Pick<TagTypeDef, "key" | "window">>(
  type: T,
  windows: TagWindows,
): T {
  return Object.hasOwn(windows, type.key)
    ? { ...type, window: windows[type.key] }
    : type;
}
