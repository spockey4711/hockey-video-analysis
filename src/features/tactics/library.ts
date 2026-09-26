/**
 * The set-play library on the tactics page: every scene has one category from
 * a small fixed set and a few free coach tags, and the scene list filters by
 * category, view and tag and searches names and tags. Pure and client-safe;
 * the filter travels in the URL (`?q=&category=&view=&tag=`), so a filtered
 * list can be bookmarked or shared among coaches.
 */
import { PITCH_VIEWS, type PitchView } from "./pitch";

/** What a scene is about, as stored in `tactics_scenes.category`. */
export const SCENE_CATEGORIES = [
  "attack_corner",
  "defence_corner",
  "free_hit",
  "press",
  "build_up",
  "other",
] as const;

export type SceneCategory = (typeof SCENE_CATEGORIES)[number];

/** The category a scene gets when the coach picks none. */
export const DEFAULT_SCENE_CATEGORY: SceneCategory = "other";

/** At most this many tags per scene. */
export const MAX_SCENE_TAGS = 10;

/** At most this many characters per tag. */
export const MAX_SCENE_TAG_LENGTH = 30;

/** At most this many characters in the search field. */
export const MAX_SCENE_QUERY_LENGTH = 120;

/** A category from a form or the URL, or `null` when it is not one. */
export function parseSceneCategory(value: unknown): SceneCategory | null {
  return SCENE_CATEGORIES.find((category) => category === value) ?? null;
}

/** One tag with inner whitespace collapsed, as it is stored and compared. */
function cleanTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ");
}

/** How two tags or a tag and a search compare: case- and accent-insensitive. */
function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("de-DE");
}

/**
 * Split the comma-separated tags field into the stored tags: each trimmed,
 * empty ones dropped, and a tag that repeats another (ignoring case and
 * accents) dropped too, keeping the first spelling. A missing field is no
 * tags. `null` when there are more than {@link MAX_SCENE_TAGS} tags or one is
 * longer than {@link MAX_SCENE_TAG_LENGTH} characters.
 */
export function normalizeSceneTags(value: unknown): string[] | null {
  if (value === null || value === undefined) return [];
  if (typeof value !== "string") return null;
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of value.split(",")) {
    const tag = cleanTag(raw);
    if (tag.length === 0) continue;
    if (tag.length > MAX_SCENE_TAG_LENGTH) return null;
    const key = foldText(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.length > MAX_SCENE_TAGS ? null : tags;
}

/** The tags as the editor's text field shows them. */
export function formatSceneTags(tags: readonly string[]): string {
  return tags.join(", ");
}

/** What the scene list is narrowed to; `null` or empty means "any". */
export interface SceneFilter {
  readonly query: string;
  readonly category: SceneCategory | null;
  readonly view: PitchView | null;
  readonly tag: string | null;
}

export const EMPTY_SCENE_FILTER: SceneFilter = {
  query: "",
  category: null,
  view: null,
  tag: null,
};

/** The fields of a scene the filter looks at. */
export interface FilterableScene {
  readonly name: string;
  readonly category: SceneCategory;
  readonly view: PitchView;
  readonly tags: readonly string[];
}

type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a search param, as a repeated one arrives as a list. */
function firstParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Read the filter from the page's search params. Anything unknown or
 * malformed falls back to "any", so a stale or hand-edited URL still shows
 * a list.
 */
export function parseSceneFilter(params: SearchParams): SceneFilter {
  const query = (firstParam(params, "q") ?? "")
    .trim()
    .slice(0, MAX_SCENE_QUERY_LENGTH);
  const tag = cleanTag(firstParam(params, "tag") ?? "");
  const view = firstParam(params, "view");
  return {
    query,
    category: parseSceneCategory(firstParam(params, "category")),
    view: PITCH_VIEWS.find((known) => known === view) ?? null,
    tag: tag.length > 0 && tag.length <= MAX_SCENE_TAG_LENGTH ? tag : null,
  };
}

/** Whether the filter narrows the list at all. */
export function isSceneFilterSet(filter: SceneFilter): boolean {
  return (
    filter.query !== "" ||
    filter.category !== null ||
    filter.view !== null ||
    filter.tag !== null
  );
}

/** The filter as a query string (with its `?`), or `""` when none is set. */
export function sceneFilterQuery(filter: SceneFilter): string {
  const params = new URLSearchParams();
  if (filter.query) params.set("q", filter.query);
  if (filter.category) params.set("category", filter.category);
  if (filter.view) params.set("view", filter.view);
  if (filter.tag) params.set("tag", filter.tag);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Whether one scene passes the filter: every set criterion must hold. The
 * search matches a part of the name or of a tag; search and tag compare
 * ignoring case and accents, so "ecke" finds "Ecke" and "Überzahl" is found
 * by "uberzahl".
 */
export function matchesSceneFilter(
  scene: FilterableScene,
  filter: SceneFilter,
): boolean {
  if (filter.category && scene.category !== filter.category) return false;
  if (filter.view && scene.view !== filter.view) return false;
  if (filter.tag) {
    const wanted = foldText(filter.tag);
    if (!scene.tags.some((tag) => foldText(tag) === wanted)) return false;
  }
  if (filter.query) {
    const words = foldText(filter.query).split(/\s+/).filter(Boolean);
    const haystack = [scene.name, ...scene.tags].map(foldText).join("\n");
    if (!words.every((word) => haystack.includes(word))) return false;
  }
  return true;
}

/** The scenes that pass the filter, in their given order. */
export function filterScenes<T extends FilterableScene>(
  scenes: readonly T[],
  filter: SceneFilter,
): T[] {
  return scenes.filter((scene) => matchesSceneFilter(scene, filter));
}

/**
 * Every tag used on any scene, once each (the first spelling seen), sorted
 * alphabetically for the tag filter.
 */
export function collectSceneTags(
  scenes: readonly Pick<FilterableScene, "tags">[],
): string[] {
  const byKey = new Map<string, string>();
  for (const scene of scenes) {
    for (const tag of scene.tags) {
      const key = foldText(tag);
      if (!byKey.has(key)) byKey.set(key, tag);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.localeCompare(b, "de-DE", { sensitivity: "base" }),
  );
}
