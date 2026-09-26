/**
 * The board's clipboard: selected tokens and lines copied from one scene and
 * pasted into the same scene or another of the same view. It lives in the
 * browser's local storage, so it outlasts a page change and reaches the
 * coach's other tabs, and it never leaves the device.
 *
 * What was copied is kept as pitch metres, like a scene. A token keeps where
 * it stood on the step on show but not its runs or its roster link: pasted
 * twice, one roster player would stand on the board twice. Storage is
 * outside this code's control, so a stored clip passes the scene parser
 * before anything is pasted from it.
 */
import { keyframePositions } from "./animation";
import type { BoardState } from "./board-state";
import { PITCH_VIEWS, type PitchView } from "./pitch";
import {
  parseScene,
  SCENE_VERSION,
  type BoardLine,
  type BoardToken,
} from "./scene";

export interface BoardClip {
  /** The view it was copied from; it pastes only into a scene of that view. */
  readonly view: PitchView;
  readonly tokens: readonly BoardToken[];
  /** The lines as drawn; a paste puts them on the step on show. */
  readonly lines: readonly BoardLine[];
}

/** The selection as a clip, or `null` when nothing is selected. */
export function clipOf(state: BoardState): BoardClip | null {
  const { scene, step, selectedIds } = state;
  if (selectedIds.length === 0) return null;
  const positions = keyframePositions(scene, step);
  const tokens = scene.tokens.flatMap((token) => {
    const at = positions.get(token.id);
    if (!selectedIds.includes(token.id) || !at) return [];
    const unlinked =
      token.kind === "player" ? { ...token, playerId: null } : token;
    return [{ ...unlinked, ...at }];
  });
  const lines = scene.lines.filter((line) => selectedIds.includes(line.id));
  if (tokens.length + lines.length === 0) return null;
  return { view: scene.view, tokens, lines };
}

/** Validate an untrusted clip (parsed JSON), returning a clean copy or `null`. */
export function parseClip(raw: unknown): BoardClip | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;
  const value = raw as Record<string, unknown>;
  if (!PITCH_VIEWS.some((view) => view === value.view)) return null;
  const lines = Array.isArray(value.lines)
    ? value.lines.map((line: unknown) =>
        typeof line === "object" && line !== null ? { ...line, step: 0 } : line,
      )
    : value.lines;
  const scene = parseScene({
    version: SCENE_VERSION,
    view: value.view,
    tokens: value.tokens,
    lines,
    steps: [],
  });
  if (!scene || scene.tokens.length + scene.lines.length === 0) return null;
  return { view: scene.view, tokens: scene.tokens, lines: scene.lines };
}

/** The local-storage key the clip is kept under. */
export const CLIP_STORAGE_KEY = "tactics-board-clip";
/** The event a copy fires in its own tab; other tabs hear `storage`. */
const CLIP_EVENT = "tactics-board-clip";

/** The stored clip's text, or `null` when there is none or storage is off. */
export function storedClipText(): string | null {
  try {
    return window.localStorage.getItem(CLIP_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The stored clip, validated, or `null`. */
export function readClip(text: string | null): BoardClip | null {
  if (text === null) return null;
  try {
    return parseClip(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Keep a clip for the next paste. Without storage (a private window) it is dropped. */
export function writeClip(clip: BoardClip): void {
  try {
    window.localStorage.setItem(CLIP_STORAGE_KEY, JSON.stringify(clip));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CLIP_EVENT));
}

/** Call back whenever the stored clip may have changed, here or in another tab. */
export function subscribeToClip(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CLIP_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CLIP_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CLIP_EVENT, onChange);
  };
}
