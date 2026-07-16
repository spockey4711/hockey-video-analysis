"use client";

/**
 * Shared clip-board state for the watch workspace (P2-1). One provider owns the
 * game's clips - the initial read, the polling while any cut is in flight, and
 * the enqueue - so every surface that touches clips reads one source of truth:
 * the top bar's "Clips schneiden" action, the per-tag cut/status control in the
 * tags rail, and the tag detail panel all stay in step without racing separate
 * copies. Live data never touches the DB from the client (see the stack notes):
 * reads and the enqueue both go through the `/api/clips` route.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  hasInFlightClips,
  latestClipByTag,
  toClipView,
  type ClipView,
} from "./clip-board";

/** How often to re-read clip status while a cut is still in flight. */
const POLL_INTERVAL_MS = 4000;

export interface ClipBoardValue {
  /** The current clip per tag id (newest wins). */
  readonly byTag: ReadonlyMap<string, ClipView>;
  /** Tag ids whose enqueue request is in flight, for a per-row busy state. */
  readonly enqueueingTagIds: ReadonlySet<string>;
  /** Queue a cut for a tag; resolves to the clip row, or throws on failure. */
  readonly enqueue: (tagId: string) => Promise<ClipView | null>;
}

const ClipBoardContext = createContext<ClipBoardValue | null>(null);

export function ClipBoardProvider({
  gameId,
  children,
}: {
  readonly gameId: string;
  readonly children: ReactNode;
}) {
  const [clips, setClips] = useState<readonly ClipView[]>([]);
  const [enqueueingTagIds, setEnqueueingTagIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Read the game's clips through the route handler; failures stay silent (the
  // next poll or enqueue refreshes) so the surfaces still list tags meanwhile.
  const load = useCallback(async (): Promise<ClipView[] | null> => {
    const response = await fetch(`/api/clips?gameId=${gameId}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { clips?: unknown };
    if (!Array.isArray(data.clips)) return null;
    return data.clips
      .map(toClipView)
      .filter((clip): clip is ClipView => clip !== null);
  }, [gameId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await load();
      if (active && next) setClips(next);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const byTag = useMemo(() => latestClipByTag(clips), [clips]);

  // Poll only while a cut is still moving; stop once every clip is terminal.
  useEffect(() => {
    if (!hasInFlightClips(byTag)) return;
    const timer = setInterval(() => {
      void (async () => {
        const next = await load();
        if (next) setClips(next);
      })();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [byTag, load]);

  const enqueue = useCallback(
    async (tagId: string): Promise<ClipView | null> => {
      setEnqueueingTagIds((prev) => new Set(prev).add(tagId));
      try {
        const response = await fetch("/api/clips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
        if (!response.ok) {
          throw new Error(`enqueue failed with ${response.status}`);
        }
        const { clip } = (await response.json()) as { clip: unknown };
        // The idempotent route may return a clip already covering the tag; either
        // way it is this tag's current status, so prepend it (newest wins).
        const view = toClipView(clip);
        if (view) setClips((current) => [view, ...current]);
        return view;
      } finally {
        setEnqueueingTagIds((prev) => {
          const next = new Set(prev);
          next.delete(tagId);
          return next;
        });
      }
    },
    [],
  );

  const value = useMemo<ClipBoardValue>(
    () => ({ byTag, enqueueingTagIds, enqueue }),
    [byTag, enqueueingTagIds, enqueue],
  );

  return (
    <ClipBoardContext.Provider value={value}>
      {children}
    </ClipBoardContext.Provider>
  );
}

/** Read the shared clip-board state; throws if used outside the provider. */
export function useClipBoard(): ClipBoardValue {
  const value = useContext(ClipBoardContext);
  if (!value) {
    throw new Error("useClipBoard must be used inside a ClipBoardProvider.");
  }
  return value;
}
