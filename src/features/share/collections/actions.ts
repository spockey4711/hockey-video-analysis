"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { collectionsContent } from "./content";
import { savePresenterNotes } from "./presenter-notes";
import {
  createCollection,
  deleteCollection,
  rotateCollectionShareToken,
  saveCollection,
} from "./queries";
import type { CollectionMutationState, CreateCollectionState } from "./state";
import { saveTeamNotes } from "./team-notes";
import {
  isValidId,
  normalizeClipIds,
  normalizeName,
  parsePresenterNotes,
  parseTeamNotes,
} from "./validation";

import { requireCoach } from "@/features/access";
import { getCurrentCoach } from "@/lib/auth";

const { errors } = collectionsContent.coach;

/**
 * Create an empty collection, then redirect to its detail page so the coach can
 * pick clips. Coach-only: `requireCoach` both authorizes the mutation and
 * supplies the `createdBy` author. The name is validated before any query runs.
 */
export async function createCollectionAction(
  _prev: CreateCollectionState,
  formData: FormData,
): Promise<CreateCollectionState> {
  const coach = await requireCoach();

  const name = normalizeName(formData.get("name"));
  if (name === null) return { error: errors.invalidName };

  let created: Awaited<ReturnType<typeof createCollection>>;
  try {
    created = await createCollection({ name, createdBy: coach.id });
  } catch {
    return { error: errors.unexpected };
  }

  // `redirect` throws, so it stays outside the try/catch above.
  redirect(`/collections/${created.id}`);
}

/**
 * Save a collection's name and clip membership. Coach-only. The collection id,
 * name, ticked clip ids and listed clip ids all arrive from the form and are
 * validated before any query runs; unknown or non-ready clip ids are dropped by
 * the query, and only listed clips can leave the collection. On success the
 * detail page is revalidated so the saved state is reflected.
 */
export async function saveCollectionAction(
  _prev: CollectionMutationState,
  formData: FormData,
): Promise<CollectionMutationState> {
  const coach = await requireCoachOrNull();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const collectionId = formData.get("collectionId");
  if (!isValidId(collectionId)) {
    return { status: "error", error: errors.invalidId };
  }

  const name = normalizeName(formData.get("name"));
  if (name === null) return { status: "error", error: errors.invalidName };

  const clipIds = normalizeClipIds(formData.getAll("clipId"));
  const listedClipIds = normalizeClipIds(formData.getAll("listedClipId"));

  let saved: boolean;
  try {
    saved = await saveCollection(collectionId, {
      name,
      clipIds,
      listedClipIds,
    });
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!saved) return { status: "error", error: errors.notFound };

  revalidatePath(`/collections/${collectionId}`);
  return { status: "success" };
}

/**
 * Save a collection's presenter notes: the note for the whole collection and one
 * per clip in it. Coach-only, as the notes are private to the coach. Every note
 * is validated before any query runs, and one invalid note rejects the whole
 * save so nothing is half-stored; notes for clips outside the collection are
 * ignored by the query.
 */
export async function savePresenterNotesAction(
  _prev: CollectionMutationState,
  formData: FormData,
): Promise<CollectionMutationState> {
  const coach = await requireCoachOrNull();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const collectionId = formData.get("collectionId");
  if (!isValidId(collectionId)) {
    return { status: "error", error: errors.invalidId };
  }

  const notes = parsePresenterNotes(formData);
  if (notes === null) return { status: "error", error: errors.invalidNote };

  let saved: boolean;
  try {
    saved = await savePresenterNotes(collectionId, notes);
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!saved) return { status: "error", error: errors.notFound };

  revalidatePath(`/collections/${collectionId}`);
  return { status: "success" };
}

/**
 * Save a collection's team notes: the intro for the whole collection and a
 * short text per clip in it, public to anyone with the collection link.
 * Coach-only, as only the coach writes them. Every note is validated before any
 * query runs, and one invalid note rejects the whole save so nothing is
 * half-stored; notes for clips outside the collection are ignored by the query.
 */
export async function saveTeamNotesAction(
  _prev: CollectionMutationState,
  formData: FormData,
): Promise<CollectionMutationState> {
  const coach = await requireCoachOrNull();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const collectionId = formData.get("collectionId");
  if (!isValidId(collectionId)) {
    return { status: "error", error: errors.invalidId };
  }

  const notes = parseTeamNotes(formData);
  if (notes === null) return { status: "error", error: errors.invalidTeamNote };

  let saved: boolean;
  try {
    saved = await saveTeamNotes(collectionId, notes);
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!saved) return { status: "error", error: errors.notFound };

  revalidatePath(`/collections/${collectionId}`);
  return { status: "success" };
}

/**
 * Rotate a collection's share token, revoking the currently shared link.
 * Coach-only. On success the detail page is revalidated so the new link shows.
 */
export async function rotateCollectionTokenAction(
  _prev: CollectionMutationState,
  formData: FormData,
): Promise<CollectionMutationState> {
  const coach = await requireCoachOrNull();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const collectionId = formData.get("collectionId");
  if (!isValidId(collectionId)) {
    return { status: "error", error: errors.invalidId };
  }

  let rotated: Awaited<ReturnType<typeof rotateCollectionShareToken>>;
  try {
    rotated = await rotateCollectionShareToken(collectionId);
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!rotated) return { status: "error", error: errors.notFound };

  revalidatePath(`/collections/${collectionId}`);
  return { status: "success" };
}

/**
 * Delete a collection, then redirect to the list. Coach-only. The underlying
 * clips are untouched; only the collection and its link are removed.
 */
export async function deleteCollectionAction(
  _prev: CollectionMutationState,
  formData: FormData,
): Promise<CollectionMutationState> {
  const coach = await requireCoachOrNull();
  if (!coach) return { status: "error", error: errors.unauthorized };

  const collectionId = formData.get("collectionId");
  if (!isValidId(collectionId)) {
    return { status: "error", error: errors.invalidId };
  }

  let deleted: boolean;
  try {
    deleted = await deleteCollection(collectionId);
  } catch {
    return { status: "error", error: errors.unexpected };
  }
  if (!deleted) return { status: "error", error: errors.notFound };

  revalidatePath("/collections");
  // `redirect` throws, so it stays outside the try/catch above.
  redirect("/collections");
}

/**
 * Return the signed-in coach, or `null` when there is no valid session. The
 * in-place mutations report unauthorized as form state (rather than redirecting
 * like `requireCoach`) so a stale tab surfaces a message instead of a bounce.
 */
function requireCoachOrNull() {
  return getCurrentCoach();
}
