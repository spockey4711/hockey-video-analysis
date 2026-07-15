/**
 * Tag-type set for the coach app: the product's core coded moments (PRD s2) with
 * their German display labels.
 *
 * TEMPORARY stand-in for the P1-3 config module (`src/lib/tag-types/**`), which
 * will own the *configurable* tag-type set and each type's default capture window.
 * DS-3 is a W2 component task that lands before P1-3, so `TagChip` reads the set
 * from here for now. When P1-3 exists, re-source `TagType` / `TAG_TYPES` from it
 * and delete this file - the seam is deliberately narrow (an id -> label map). The
 * per-type color coding never lives here; it is fixed in the design tokens
 * (`--tag-<id>` / `--tag-<id>-ink`, see `docs/design/README.md`).
 */

/** The five coded moments a coach can tag; keys of the `--tag-*` token palette. */
export type TagType = "tor" | "ecke" | "gut" | "schlecht" | "whistle";

export interface TagTypeConfig {
  readonly id: TagType;
  /** German chip label (see `docs/design/README.md` domain vocabulary). */
  readonly label: string;
}

/** Ordered tag-type set the tagging UI renders as chips. */
export const TAG_TYPES: readonly TagTypeConfig[] = [
  { id: "tor", label: "Tor" },
  { id: "ecke", label: "Ecke kurz" },
  { id: "gut", label: "Aktion gut" },
  { id: "schlecht", label: "Aktion schlecht" },
  { id: "whistle", label: "Vorschlag" },
];

const BY_ID = Object.fromEntries(
  TAG_TYPES.map((config) => [config.id, config]),
) as Record<TagType, TagTypeConfig>;

/** Default German label for a tag type; overridable per `TagChip`. */
export function tagTypeLabel(id: TagType): string {
  return BY_ID[id].label;
}
