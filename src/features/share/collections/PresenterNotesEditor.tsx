"use client";

import { NotesEditorCard, type NotesEditorClip } from "./NotesEditorCard";
import { savePresenterNotesAction } from "./actions";
import { collectionsContent } from "./content";
import {
  CLIP_NOTE_FIELD_PREFIX,
  COLLECTION_NOTE_FIELD,
  MAX_PRESENTER_NOTE_LENGTH,
} from "./validation";

const FIELDS = {
  collection: COLLECTION_NOTE_FIELD,
  clipPrefix: CLIP_NOTE_FIELD_PREFIX,
  maxLength: MAX_PRESENTER_NOTE_LENGTH,
} as const;

export interface PresenterNotesEditorProps {
  readonly collectionId: string;
  /** The stored note for the whole collection, `null` when none. */
  readonly collectionNote: string | null;
  /** The clips in the collection, in playlist order, each with its stored note. */
  readonly clips: readonly NotesEditorClip[];
}

/**
 * Write the private presenter notes for a collection: one for the whole
 * collection and one per clip in it, in the order the link plays them. The
 * notes show in presentation mode on the collection link for a signed-in coach
 * only.
 */
export function PresenterNotesEditor(props: PresenterNotesEditorProps) {
  return (
    <NotesEditorCard
      {...props}
      action={savePresenterNotesAction}
      copy={collectionsContent.coach.detail.notes}
      icon="eye-off"
      fields={FIELDS}
    />
  );
}
