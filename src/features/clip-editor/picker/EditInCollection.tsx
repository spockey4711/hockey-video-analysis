"use client";

import { useEffect, useState } from "react";

import { NewCollectionForm } from "./NewCollectionForm";
import {
  addClip,
  type CollectionChoice,
  createCollection,
  type CreateOutcome,
  editorPath,
  loadCollections,
} from "./client";
import { pickerContent } from "./content";

import { Icon } from "@/components/core/Icon";
import { Button } from "@/components/forms/Button";
import { normalizeName } from "@/features/share/collections/validation";

export interface EditInCollectionProps {
  /** The ready clip to edit. */
  readonly clipId: string;
  /** Called when the editor has opened, or the coach cancels. */
  readonly onDone: () => void;
}

const { watch: copy } = pickerContent;

/**
 * Open a new tab for the clip editor while the click still counts as the
 * coach's own, so the browser does not block it as a popup; the editor's URL
 * is only known once the collection is. `null` when it was blocked anyway.
 */
function openBlankTab(): Window | null {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  return tab;
}

/**
 * The watch page's "In Sammlung bearbeiten" (ADR 0011): pick a collection, or
 * name a new one, and the clip editor opens in a new tab with this clip in the
 * collection and selected. A collection that already holds the clip opens on
 * it as it is, since one clip is at most one entry of a collection.
 */
export function EditInCollection({ clipId, onDone }: EditInCollectionProps) {
  const [collections, setCollections] = useState<
    CollectionChoice[] | "loading" | "failed"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // The editor's URL when the browser blocked its tab, to open by hand.
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadCollections().then((list) => {
      if (live) setCollections(list ?? "failed");
    });
    return () => {
      live = false;
    };
  }, []);

  /** Start a request in a fresh tab that {@link finish} then points. */
  function begin(): Window | null {
    setBusy(true);
    setFailed(false);
    return openBlankTab();
  }

  /**
   * Open the editor on the clip in `collectionId`, or drop the tab and, when
   * `report` says so, say it failed.
   */
  function finish(
    tab: Window | null,
    collectionId: string | null,
    report: boolean,
  ) {
    setBusy(false);
    if (collectionId === null) {
      tab?.close();
      setFailed(report);
      return;
    }
    const url = editorPath(collectionId, clipId);
    if (tab) {
      tab.location.href = url;
      onDone();
    } else {
      setBlockedUrl(url);
    }
  }

  async function choose(collection: CollectionChoice) {
    const tab = begin();
    const outcome = await addClip(collection.id, clipId);
    // A clip already in the collection opens there as it is.
    finish(tab, outcome === "failed" ? null : collection.id, true);
  }

  async function create(name: string): Promise<CreateOutcome> {
    // Check the name first, so a wrong one never flashes a tab open.
    if (normalizeName(name) === null) return { status: "invalid-name" };
    const tab = begin();
    const outcome = await createCollection(name, clipId);
    // The form says itself why the collection was not created.
    finish(tab, outcome.status === "created" ? outcome.id : null, false);
    return outcome;
  }

  if (blockedUrl) {
    return (
      <div className="flex flex-col gap-[var(--space-3)] text-[length:var(--fs-body-sm)]">
        <p className="text-[color:var(--text-secondary)]">{copy.blocked}</p>
        <div className="flex items-center gap-[var(--space-1)]">
          <a
            href={blockedUrl}
            target="_blank"
            rel="noreferrer"
            onClick={onDone}
            className="flex items-center gap-[var(--space-1)] text-[color:var(--text-brand)] underline-offset-2 hover:underline"
          >
            {copy.openEditor}
            <Icon name="arrow-up-right" size={14} />
          </a>
          <Button
            size="sm"
            variant="ghost"
            className="ms-auto"
            onClick={onDone}
          >
            {copy.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)] text-[length:var(--fs-body-sm)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        {/* eslint-disable-next-line no-restricted-syntax -- a body-size run-in title inside the picker dialog, below every Heading rung. */}
        <h3 className="[font-weight:var(--fw-semibold)]">{copy.heading}</h3>
        <p className="text-[color:var(--text-muted)]">{copy.hint}</p>
      </div>

      {collections === "loading" ? (
        <p role="status" className="text-[color:var(--text-muted)]">
          {copy.loading}
        </p>
      ) : collections === "failed" ? (
        <p role="alert" className="text-[color:var(--danger)]">
          {copy.loadFailed}
        </p>
      ) : collections.length === 0 ? (
        <p className="text-[color:var(--text-muted)]">{copy.none}</p>
      ) : (
        <ul className="flex max-h-[30vh] flex-col gap-[var(--space-1)] overflow-y-auto">
          {collections.map((collection) => (
            <li key={collection.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void choose(collection)}
                className="flex w-full items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[color:var(--border)] px-[var(--space-3)] py-[var(--space-2)] text-left transition duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-hover)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate [font-weight:var(--fw-medium)]">
                  {collection.name}
                </span>
                <span className="shrink-0 text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                  {copy.clipCount(collection.clipCount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <NewCollectionForm
        create={create}
        label={pickerContent.create.open}
        submitLabel={pickerContent.create.submitWithClip}
      />

      <p role="status" className="text-[color:var(--danger)] empty:hidden">
        {failed ? copy.failed : ""}
      </p>

      <div>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDone}>
          {copy.cancel}
        </Button>
      </div>
    </div>
  );
}
