"use client";

/**
 * Live tag store for a watch session (P1-1 follow-up). The watch page seeds this
 * with the game's tags loaded server-side, then `TaggingPanel` mutates it as the
 * coach captures, edits and deletes tags in-session. Sibling lanes read the same
 * list - the jump-marker overlay and nav derive their markers from it - so a
 * fresh capture shows up instantly, without a page reload.
 *
 * This is the single source of truth for the game's tags on the client: lifting
 * it out of `TaggingPanel` lets the tag list and the jump markers stay in sync
 * off one list rather than two that could drift.
 */
import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { EditableTag } from "./edit/queries";

/** Order tags by their clip-window start, matching the server list order. */
function byStart(a: EditableTag, b: EditableTag): number {
  return a.startS - b.startS;
}

/** The live tag list plus the mutations the tagging UI drives it with. */
export interface GameTagsController {
  /** The game's tags, kept in start-time order (empty when none captured). */
  readonly tags: readonly EditableTag[];
  /** Insert a freshly captured tag, keeping the list in start order. */
  readonly addTag: (tag: EditableTag) => void;
  /** Replace an edited tag in place (by id), re-sorting on a start change. */
  readonly replaceTag: (tag: EditableTag) => void;
  /** Remove a deleted tag by id. */
  readonly removeTag: (id: string) => void;
}

const GameTagsContext = createContext<GameTagsController | null>(null);

export interface GameTagsProviderProps {
  /** Tags loaded server-side, seeding the live list. */
  readonly initialTags?: readonly EditableTag[];
  readonly children: ReactNode;
}

/**
 * Provide the live tag store to a watch session. Wrap the player so both the
 * tagging panel (writer) and the jump-marker slots (readers) share one list.
 */
export function GameTagsProvider({
  initialTags = [],
  children,
}: GameTagsProviderProps) {
  const [tags, setTags] = useState<EditableTag[]>(() =>
    [...initialTags].sort(byStart),
  );

  const controller = useMemo<GameTagsController>(
    () => ({
      tags,
      addTag: (tag) => setTags((current) => [...current, tag].sort(byStart)),
      replaceTag: (tag) =>
        setTags((current) =>
          current.map((t) => (t.id === tag.id ? tag : t)).sort(byStart),
        ),
      removeTag: (id) =>
        setTags((current) => current.filter((t) => t.id !== id)),
    }),
    [tags],
  );

  return (
    <GameTagsContext.Provider value={controller}>
      {children}
    </GameTagsContext.Provider>
  );
}

/**
 * Read the live tag store. Throws when used outside {@link GameTagsProvider}, so
 * a consumer mounted in the wrong place fails loudly rather than silently going
 * stale.
 */
export function useGameTags(): GameTagsController {
  const controller = useContext(GameTagsContext);
  if (!controller) {
    throw new Error("useGameTags must be used inside a GameTagsProvider.");
  }
  return controller;
}
