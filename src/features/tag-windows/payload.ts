/**
 * The `GET /api/tag-windows` payload: every configured tag type, in display
 * order, with the window a new capture of it gets. Every type is listed, set by
 * the team or not, so a client needs no merge rule of its own; `isDefault` only
 * tells it whether the team changed the type.
 */
import {
  DEFAULT_TAG_WINDOWS,
  TAG_TYPES,
  sameTagWindow,
  type TagWindows,
} from "@/lib/tag-types";

export interface TagWindowsPayload {
  readonly windows: readonly {
    readonly type: string;
    readonly preS: number;
    readonly postS: number;
    readonly isDefault: boolean;
  }[];
}

export function tagWindowsPayload(windows: TagWindows): TagWindowsPayload {
  return {
    windows: TAG_TYPES.map(({ key }) => {
      const fallback = DEFAULT_TAG_WINDOWS[key];
      const window = Object.hasOwn(windows, key) ? windows[key] : fallback;
      return {
        type: key,
        preS: window.preS,
        postS: window.postS,
        isDefault: sameTagWindow(window, fallback),
      };
    }),
  };
}
