"use client";

import { useActionState } from "react";

import { saveCollectionAction } from "./actions";
import { collectionsContent } from "./content";
import type { CurationItem } from "./curation-items";
import { collectionMutationInitialState } from "./state";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { detail } = collectionsContent.coach;

export interface CollectionEditorProps {
  readonly collectionId: string;
  readonly name: string;
  /** Every ready clip, pre-marked with whether it is in this collection. */
  readonly items: readonly CurationItem[];
}

/**
 * Edit a collection: its name and which ready clips it holds. The clips are a
 * flat checklist (checked = in the collection); the coach ticks the ones to
 * share and saves. Submitting posts the name plus one `clipId` per checked box,
 * which the server intersects with the ready-clip set before storing.
 */
export function CollectionEditor({
  collectionId,
  name,
  items,
}: CollectionEditorProps) {
  const [state, formAction, pending] = useActionState(
    saveCollectionAction,
    collectionMutationInitialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-[var(--space-5)]">
      <input type="hidden" name="collectionId" value={collectionId} />

      {state.status === "error" && state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      <Input
        name="name"
        label={detail.nameLabel}
        defaultValue={name}
        autoComplete="off"
        required
      />

      <fieldset className="flex flex-col gap-[var(--space-3)]">
        <legend className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-secondary)] uppercase">
          {detail.clipsHeading}
        </legend>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {detail.clipsDescription}
        </p>

        {items.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-4)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {detail.noClips}
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-1)]">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)]">
                  <input
                    type="checkbox"
                    name="clipId"
                    value={item.id}
                    defaultChecked={item.checked}
                    className="mt-[var(--space-1)] size-[var(--space-4)] shrink-0 accent-[var(--accent)]"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-[var(--space-2)] text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] text-[color:var(--text-primary)]">
                      {item.title}
                      {item.isSingle && (
                        <span className="rounded-[var(--radius-pill)] border border-[color:var(--border-subtle)] px-[var(--space-2)] text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                          {detail.singleBadge}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                      {item.subtitle}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="flex items-center gap-[var(--space-3)]">
        <Button type="submit" disabled={pending} iconLeft="check">
          {detail.save}
        </Button>
        {state.status === "success" && (
          <span
            aria-live="polite"
            className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]"
          >
            {detail.saved}
          </span>
        )}
      </div>
    </form>
  );
}
