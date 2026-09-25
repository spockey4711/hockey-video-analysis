"use client";

/**
 * The editor's working copies of its entries' edits, saved on their own
 * (ADR 0011). A change is saved shortly after the coach stops changing it,
 * one save at a time, through `PUT /api/collections/[id]/clips/[clipId]/edit`
 * with the version it started from. A save refused as a conflict (the entry
 * was saved from another tab) is not retried; the coach reloads the entry
 * from the server. Other failures are retried on the next change.
 */
import { useCallback, useEffect, useReducer } from "react";

import type { ClipEdit } from "@/features/clip-edits";

/** Where one entry's working copy stands against the server. */
export type DraftState = "saved" | "dirty" | "saving" | "conflict" | "error";

export interface Draft {
  readonly edit: ClipEdit | null;
  /** The version the next save names. */
  readonly version: number;
  readonly state: DraftState;
}

/** How the editor as a whole stands, for its save indicator. */
export type SaveStatus = "saved" | "pending" | "conflict" | "error";

/** How long after the last change a save goes out, in milliseconds. */
export const SAVE_DELAY_MS = 600;

type Drafts = Readonly<Record<string, Draft>>;

type Action =
  | { type: "change"; id: string; edit: ClipEdit | null; base: Draft }
  | { type: "saving"; id: string }
  | { type: "saved"; id: string; sent: ClipEdit | null; version: number }
  | { type: "failed"; id: string; state: "conflict" | "error" }
  | { type: "reloaded"; id: string; edit: ClipEdit | null; version: number };

function reduce(drafts: Drafts, action: Action): Drafts {
  const current = drafts[action.id];
  switch (action.type) {
    case "change":
      return {
        ...drafts,
        [action.id]: {
          ...(current ?? action.base),
          edit: action.edit,
          // A change during a save waits for it; one after a conflict stays
          // unsaved until the coach reloads.
          state: current?.state === "conflict" ? "conflict" : "dirty",
        },
      };
    case "saving":
      return { ...drafts, [action.id]: { ...current, state: "saving" } };
    case "saved":
      return {
        ...drafts,
        [action.id]: {
          ...current,
          version: action.version,
          state: current.edit === action.sent ? "saved" : "dirty",
        },
      };
    case "failed":
      return { ...drafts, [action.id]: { ...current, state: action.state } };
    case "reloaded":
      return {
        ...drafts,
        [action.id]: {
          edit: action.edit,
          version: action.version,
          state: "saved",
        },
      };
  }
}

/** The one status the whole editor shows: the most urgent of its entries. */
export function saveStatusOf(drafts: Drafts): SaveStatus {
  const states = Object.values(drafts).map((draft) => draft.state);
  if (states.includes("conflict")) return "conflict";
  if (states.includes("error")) return "error";
  if (states.includes("dirty") || states.includes("saving")) return "pending";
  return "saved";
}

function editUrl(collectionId: string, clipId: string): string {
  return `/api/collections/${collectionId}/clips/${clipId}/edit`;
}

export interface EditDrafts {
  /** The entry's working copy; an entry never changed here reads as `base`. */
  readonly draftOf: (id: string, base: Draft) => Draft;
  readonly change: (id: string, edit: ClipEdit | null, base: Draft) => void;
  /** Replace a conflicting working copy with the server's. */
  readonly reload: (id: string) => Promise<void>;
  readonly status: SaveStatus;
}

export function useEditDrafts(collectionId: string): EditDrafts {
  const [drafts, dispatch] = useReducer(reduce, {});
  const status = saveStatusOf(drafts);

  // Save the first unsaved entry once changes settle, never two at a time.
  useEffect(() => {
    const entries = Object.entries(drafts);
    if (entries.some(([, draft]) => draft.state === "saving")) return;
    const next = entries.find(([, draft]) => draft.state === "dirty");
    if (!next) return;
    const [id, draft] = next;
    const timer = setTimeout(() => {
      dispatch({ type: "saving", id });
      void fetch(editUrl(collectionId, id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: draft.version, edit: draft.edit }),
      })
        .then(async (response) => {
          if (response.ok) {
            const body = (await response.json()) as { version: number };
            dispatch({
              type: "saved",
              id,
              sent: draft.edit,
              version: body.version,
            });
          } else {
            dispatch({
              type: "failed",
              id,
              state: response.status === 409 ? "conflict" : "error",
            });
          }
        })
        .catch(() => dispatch({ type: "failed", id, state: "error" }));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [drafts, collectionId]);

  // Leaving with unsaved changes asks first.
  const unsaved = status !== "saved";
  useEffect(() => {
    if (!unsaved) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  const draftOf = useCallback(
    (id: string, base: Draft) => drafts[id] ?? base,
    [drafts],
  );
  const change = useCallback(
    (id: string, edit: ClipEdit | null, base: Draft) =>
      dispatch({ type: "change", id, edit, base }),
    [],
  );
  const reload = useCallback(
    async (id: string) => {
      const response = await fetch(editUrl(collectionId, id));
      if (!response.ok) {
        dispatch({ type: "failed", id, state: "error" });
        return;
      }
      const body = (await response.json()) as {
        edit: ClipEdit | null;
        version: number;
      };
      dispatch({
        type: "reloaded",
        id,
        edit: body.edit,
        version: body.version,
      });
    },
    [collectionId],
  );

  return { draftOf, change, reload, status };
}
