/**
 * Input validation for the tactics scene actions: the scene id, name and view
 * arrive from a coach form and are checked before any query runs. The scene
 * document itself is validated by `parseSceneJson` in `scene.ts`.
 */
import { PITCH_VIEWS, type PitchView } from "./pitch";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Max scene name length, like a collection name. */
export const MAX_SCENE_NAME_LENGTH = 120;

/** True when `value` is a syntactically valid scene id (a UUID). */
export function isValidSceneId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Trim a raw scene name and return it, or `null` when it is empty or longer
 * than {@link MAX_SCENE_NAME_LENGTH}; callers store the returned value.
 */
export function normalizeSceneName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SCENE_NAME_LENGTH)
    return null;
  return trimmed;
}

/** The view a new scene was created with, or `null` when it is not one. */
export function parseSceneView(value: unknown): PitchView | null {
  return PITCH_VIEWS.find((view) => view === value) ?? null;
}
