/**
 * Input validation for the tactics scene and formation actions: ids, names,
 * views and formation kinds arrive from a coach form and are checked before
 * any query runs. The documents themselves are validated by `parseSceneJson`
 * in `scene.ts` and `parseFormationJson` in `formation.ts`.
 */
import { FORMATION_KINDS, type FormationKind } from "./formation";
import { PITCH_VIEWS, type PitchView } from "./pitch";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Max scene name length, like a collection name. */
export const MAX_SCENE_NAME_LENGTH = 120;

/** True when `value` is a syntactically valid scene or formation id (a UUID). */
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

/** Max length of a scene's coaching points: a few talking points. */
export const MAX_COACHING_NOTES_LENGTH = 1000;

/**
 * Normalize a scene's raw coaching points: unify line breaks, trim, and
 * return them, `null` when empty (clearing them), or `undefined` when they
 * are not text or longer than {@link MAX_COACHING_NOTES_LENGTH}. A line
 * break counts as one character, as in the textarea's own `maxLength`.
 */
export function normalizeCoachingNotes(
  value: unknown,
): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\r\n?/g, "\n").trim();
  if (trimmed.length > MAX_COACHING_NOTES_LENGTH) return undefined;
  return trimmed.length === 0 ? null : trimmed;
}

/** The view a new scene was created with, or `null` when it is not one. */
export function parseSceneView(value: unknown): PitchView | null {
  return PITCH_VIEWS.find((view) => view === value) ?? null;
}

/** Whether a formation is for attack or defence, or `null` when it is neither. */
export function parseFormationKind(value: unknown): FormationKind | null {
  return FORMATION_KINDS.find((kind) => kind === value) ?? null;
}
