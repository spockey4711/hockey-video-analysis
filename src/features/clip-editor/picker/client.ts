/**
 * Browser-side requests for picking clips into a collection (ADR 0011), shared
 * by the clip editor's picker and the watch page's "In Sammlung bearbeiten".
 * Each call answers with an outcome the caller shows, never a thrown error.
 */
import type { PickerData } from "./picker";

/** The clip editor's URL for a collection, opened on `clipId` when given. */
export function editorPath(collectionId: string, clipId?: string): string {
  const path = `/collections/${collectionId}/editor`;
  return clipId ? `${path}?clip=${clipId}` : path;
}

/**
 * Add one clip to a collection: `added`, `duplicate` when it is already in it
 * (so it is not added twice), or `failed`.
 */
export async function addClip(
  collectionId: string,
  clipId: string,
): Promise<"added" | "duplicate" | "failed"> {
  try {
    const response = await fetch(`/api/collections/${collectionId}/clips`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clipId }),
    });
    if (response.ok) return "added";
    return response.status === 409 ? "duplicate" : "failed";
  } catch {
    return "failed";
  }
}

/** The outcome of creating a collection. */
export type CreateOutcome =
  | { readonly status: "created"; readonly id: string }
  | { readonly status: "invalid-name" }
  | { readonly status: "failed" };

/** Create a collection named `name`, holding `clipId` when given. */
export async function createCollection(
  name: string,
  clipId?: string,
): Promise<CreateOutcome> {
  try {
    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, clipId }),
    });
    if (response.status === 400) return { status: "invalid-name" };
    if (!response.ok) return { status: "failed" };
    const { id } = (await response.json()) as { id: string };
    return { status: "created", id };
  } catch {
    return { status: "failed" };
  }
}

/** Read the picker for a collection, or null when it could not be loaded. */
export async function loadPicker(
  collectionId: string,
): Promise<PickerData | null> {
  try {
    const response = await fetch(`/api/collections/${collectionId}/clips`);
    return response.ok ? ((await response.json()) as PickerData) : null;
  } catch {
    return null;
  }
}

/** One collection a clip can go into. */
export interface CollectionChoice {
  readonly id: string;
  readonly name: string;
  readonly clipCount: number;
}

/** Read the coach's collections, newest first, or null when that failed. */
export async function loadCollections(): Promise<CollectionChoice[] | null> {
  try {
    const response = await fetch("/api/collections");
    if (!response.ok) return null;
    const { collections } = (await response.json()) as {
      collections: CollectionChoice[];
    };
    return collections;
  } catch {
    return null;
  }
}
