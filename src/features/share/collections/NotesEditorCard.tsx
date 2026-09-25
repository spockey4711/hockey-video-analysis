"use client";

import { useActionState } from "react";

import { collectionsContent } from "./content";
import type { CurationItem } from "./curation-items";
import {
  type CollectionMutationState,
  collectionMutationInitialState,
} from "./state";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { Icon, type IconName } from "@/components/core/Icon";
import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";
import { Textarea } from "@/components/forms/Textarea";

/** One clip in the collection, in playlist order, with its stored note. */
export type NotesEditorClip = Pick<
  CurationItem,
  "id" | "title" | "subtitle"
> & {
  readonly note: string | null;
};

export interface NotesEditorCardProps {
  readonly collectionId: string;
  /** The stored note for the whole collection, `null` when none. */
  readonly collectionNote: string | null;
  readonly clips: readonly NotesEditorClip[];
  /** The coach-guarded action that validates and stores the notes. */
  readonly action: (
    prev: CollectionMutationState,
    formData: FormData,
  ) => Promise<CollectionMutationState>;
  readonly copy: {
    readonly heading: string;
    readonly description: string;
    readonly collectionLabel: string;
    readonly collectionHint: string;
    readonly noClips: { readonly title: string; readonly hint: string };
    readonly save: string;
  };
  /** Marks the card's heading, so the two kinds of notes never look alike. */
  readonly icon: IconName;
  /** Form field names and the per-note limit the action validates against. */
  readonly fields: {
    readonly collection: string;
    readonly clipPrefix: string;
    readonly maxLength: number;
  };
}

/**
 * A card that writes one kind of note for a collection: one for the whole
 * collection and one per clip in it, in the order the link plays them. Only the
 * saved members get a field, so the coach saves the clip selection first. The
 * private presenter notes and the notes for the team each get their own card,
 * form and action, so a note is only ever stored where its card says.
 */
export function NotesEditorCard({
  collectionId,
  collectionNote,
  clips,
  action,
  copy,
  icon,
  fields,
}: NotesEditorCardProps) {
  const [state, formAction, pending] = useActionState(
    action,
    collectionMutationInitialState,
  );

  return (
    <Card as="section" aria-label={copy.heading} className="p-[var(--space-4)]">
      <form action={formAction} className="flex flex-col gap-[var(--space-4)]">
        <input type="hidden" name="collectionId" value={collectionId} />

        <PanelHeader
          title={
            <span className="inline-flex items-center gap-[var(--space-2)]">
              <Icon name={icon} size={14} />
              {copy.heading}
            </span>
          }
          hint={copy.description}
        />

        {state.status === "error" && state.error && (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
          >
            {state.error}
          </p>
        )}

        <Textarea
          name={fields.collection}
          label={copy.collectionLabel}
          hint={copy.collectionHint}
          defaultValue={collectionNote ?? ""}
          maxLength={fields.maxLength}
        />

        {clips.length === 0 ? (
          <EmptyState
            icon={icon}
            size="sm"
            inset
            title={copy.noClips.title}
            hint={copy.noClips.hint}
          />
        ) : (
          <ol className="flex flex-col gap-[var(--space-4)]">
            {clips.map((clip) => {
              const fieldId = `${fields.clipPrefix}${clip.id}`;
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
                    name={`${fields.clipPrefix}${clip.id}`}
                    defaultValue={clip.note ?? ""}
                    maxLength={fields.maxLength}
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
              {collectionsContent.coach.detail.saved}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
