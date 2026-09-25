"use client";

import { useActionState } from "react";

import { savePresenterNotesAction } from "./actions";
import { collectionsContent } from "./content";
import type { CurationItem } from "./curation-items";
import { collectionMutationInitialState } from "./state";
import {
  CLIP_NOTE_FIELD_PREFIX,
  COLLECTION_NOTE_FIELD,
  MAX_PRESENTER_NOTE_LENGTH,
} from "./validation";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";
import { Textarea } from "@/components/forms/Textarea";

const { notes: copy, saved } = collectionsContent.coach.detail;

export interface PresenterNotesEditorProps {
  readonly collectionId: string;
  /** The stored note for the whole collection, `null` when none. */
  readonly collectionNote: string | null;
  /** The clips in the collection, in playlist order, each with its stored note. */
  readonly clips: readonly (Pick<CurationItem, "id" | "title" | "subtitle"> & {
    readonly note: string | null;
  })[];
}

/**
 * Write the private presenter notes for a collection: one for the whole
 * collection and one per clip in it, in the order the link plays them. Only the
 * saved members get a field, so the coach saves the clip selection first. The
 * notes show in presentation mode on the collection link for a signed-in coach
 * only.
 */
export function PresenterNotesEditor({
  collectionId,
  collectionNote,
  clips,
}: PresenterNotesEditorProps) {
  const [state, formAction, pending] = useActionState(
    savePresenterNotesAction,
    collectionMutationInitialState,
  );

  return (
    <Card as="section" aria-label={copy.heading} className="p-[var(--space-4)]">
      <form action={formAction} className="flex flex-col gap-[var(--space-4)]">
        <input type="hidden" name="collectionId" value={collectionId} />

        <PanelHeader title={copy.heading} hint={copy.description} />

        {state.status === "error" && state.error && (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
          >
            {state.error}
          </p>
        )}

        <Textarea
          name={COLLECTION_NOTE_FIELD}
          label={copy.collectionLabel}
          hint={copy.collectionHint}
          defaultValue={collectionNote ?? ""}
          maxLength={MAX_PRESENTER_NOTE_LENGTH}
        />

        {clips.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-4)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {copy.noClips}
          </p>
        ) : (
          <ol className="flex flex-col gap-[var(--space-4)]">
            {clips.map((clip) => {
              const fieldId = `clip-note-${clip.id}`;
              return (
                <li
                  key={clip.id}
                  className="flex flex-col gap-[var(--space-1)]"
                >
                  <label htmlFor={fieldId} className="flex min-w-0 flex-col">
                    <span className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] text-[color:var(--text-primary)]">
                      {clip.title}
                    </span>
                    <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                      {clip.subtitle}
                    </span>
                  </label>
                  <Textarea
                    id={fieldId}
                    name={`${CLIP_NOTE_FIELD_PREFIX}${clip.id}`}
                    defaultValue={clip.note ?? ""}
                    maxLength={MAX_PRESENTER_NOTE_LENGTH}
                    rows={2}
                  />
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex items-center gap-[var(--space-3)]">
          <Button type="submit" disabled={pending} iconLeft="check">
            {copy.save}
          </Button>
          {state.status === "success" && (
            <span
              aria-live="polite"
              className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]"
            >
              {saved}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
