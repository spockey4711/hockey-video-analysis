"use client";

import { useActionState, useState } from "react";

import { deleteCollectionAction, rotateCollectionTokenAction } from "./actions";
import { collectionsContent } from "./content";
import { collectionMutationInitialState } from "./state";

import { Card } from "@/components/core/Card";
import { Button } from "@/components/forms/Button";

const { detail } = collectionsContent.coach;

export interface CollectionSettingsProps {
  readonly collectionId: string;
  /** Absolute share URL when the deploy URL is known, else the app-relative path. */
  readonly url: string;
  /** The always-valid app-relative path shown in the field. */
  readonly path: string;
}

/**
 * The share-link panel for a collection: the copyable secret link plus the
 * rotate (revoke) and delete controls. A rotation revalidates the detail page,
 * so the `url`/`path` this receives already reflect the freshly issued token.
 */
export function CollectionSettings({
  collectionId,
  url,
  path,
}: CollectionSettingsProps) {
  const [copied, setCopied] = useState(false);
  const [rotateState, rotateAction, rotatePending] = useActionState(
    rotateCollectionTokenAction,
    collectionMutationInitialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCollectionAction,
    collectionMutationInitialState,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context); the link stays selectable.
    }
  }

  const error = rotateState.error ?? deleteState.error;

  return (
    <Card className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--fs-caption)] [font-weight:var(--fw-medium)] text-[color:var(--text-muted)]">
          {detail.shareLinkLabel}
        </span>
        <div className="flex items-center gap-[var(--space-2)]">
          <a
            href={path}
            rel="nofollow"
            className="min-w-0 flex-1 truncate rounded-[var(--radius-sm)] bg-[var(--surface-inset)] px-[var(--space-2)] py-[var(--space-1)] font-mono text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] underline-offset-2 hover:underline"
          >
            {path}
          </a>
          <Button type="button" size="sm" variant="ghost" onClick={copy}>
            {copied ? detail.copied : detail.copy}
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-2)] border-t border-[color:var(--border-subtle)] pt-[var(--space-3)]">
        <form action={rotateAction}>
          <input type="hidden" name="collectionId" value={collectionId} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            iconLeft="rewind"
            disabled={rotatePending}
          >
            {detail.rotate.submit}
          </Button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="collectionId" value={collectionId} />
          <Button
            type="submit"
            size="sm"
            variant="danger"
            iconLeft="trash-2"
            disabled={deletePending}
          >
            {detail.delete.submit}
          </Button>
        </form>
      </div>
      <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        {detail.rotate.description} {detail.delete.description}
      </p>
    </Card>
  );
}
