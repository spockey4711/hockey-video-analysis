"use client";

import { NotesEditorCard, type NotesEditorClip } from "./NotesEditorCard";
import { saveTeamNotesAction } from "./actions";
import { collectionsContent } from "./content";
import {
  MAX_TEAM_NOTE_LENGTH,
  TEAM_CLIP_NOTE_FIELD_PREFIX,
  TEAM_INTRO_FIELD,
} from "./validation";

const FIELDS = {
  collection: TEAM_INTRO_FIELD,
  clipPrefix: TEAM_CLIP_NOTE_FIELD_PREFIX,
  maxLength: MAX_TEAM_NOTE_LENGTH,
} as const;

export interface TeamNotesEditorProps {
  readonly collectionId: string;
  /** The stored intro for the whole collection, `null` when none. */
  readonly collectionNote: string | null;
  /** The clips in the collection, in playlist order, each with its stored text. */
  readonly clips: readonly NotesEditorClip[];
}

/**
 * Write the notes for the team: an intro for the collection and a short text
 * per clip in it. Unlike the presenter notes, everyone with the collection link
 * sees them, under the clip in the playlist and as title cards in presentation
 * mode, which the card's heading and hint say up front.
 */
export function TeamNotesEditor(props: TeamNotesEditorProps) {
  return (
    <NotesEditorCard
      {...props}
      action={saveTeamNotesAction}
      copy={collectionsContent.coach.detail.teamNotes}
      icon="users"
      fields={FIELDS}
    />
  );
}
