"use client";

import Link from "next/link";
import { useActionState } from "react";

import { sceneEntryAction } from "./actions";
import { collectionsContent } from "./content";
import type { RunningOrderRow } from "./running-order";
import { collectionMutationInitialState } from "./state";
import { SCENE_HOLD_SECONDS } from "./validation";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { Icon } from "@/components/core/Icon";
import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { Select } from "@/components/forms/Select";
import { buttonClassName } from "@/components/forms/button-styles";

const { scenes: copy } = collectionsContent.coach.detail;

/** A saved tactics scene the coach can add: its id and name. */
export interface SceneChoice {
  readonly id: string;
  readonly name: string;
}

export interface SceneEntriesEditorProps {
  readonly collectionId: string;
  /** The saved scenes not yet in the collection. */
  readonly choices: readonly SceneChoice[];
  /** Whether any scene exists on the tactics board at all. */
  readonly hasScenes: boolean;
  /** The play order: the ready clips with the scene entries between them. */
  readonly order: readonly RunningOrderRow[];
}

/**
 * Put tactics scenes into a collection (ADR 0014): add a saved scene, and
 * arrange the running order the link and presentation mode play - the clips
 * in their fixed chronological order, each scene moved up or down past them
 * to its place, a still scene with its hold time. Every change is its own
 * small form on one action, saved as it is made.
 */
export function SceneEntriesEditor({
  collectionId,
  choices,
  hasScenes,
  order,
}: SceneEntriesEditorProps) {
  const [state, formAction, pending] = useActionState(
    sceneEntryAction,
    collectionMutationInitialState,
  );

  return (
    <Card
      as="section"
      aria-label={copy.heading}
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]"
    >
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-[var(--space-2)]">
            <Icon name="columns-2" size={14} />
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

      {!hasScenes ? (
        <EmptyState
          icon="columns-2"
          size="sm"
          inset
          title={copy.noScenes.title}
          hint={copy.noScenes.hint}
          action={
            <Link
              href="/tactics"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              {copy.openBoard}
            </Link>
          }
        />
      ) : choices.length === 0 ? (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {copy.allAdded}
        </p>
      ) : (
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-[var(--space-3)]"
        >
          <input type="hidden" name="collectionId" value={collectionId} />
          <input type="hidden" name="intent" value="add" />
          <div className="min-w-[calc(var(--space-16)*3)] flex-1">
            <Select
              name="sceneId"
              label={copy.pickLabel}
              options={choices.map(({ id, name }) => ({
                value: id,
                label: name,
              }))}
            />
          </div>
          <Button type="submit" iconLeft="plus" disabled={pending}>
            {copy.add}
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-[var(--space-2)]">
        <PanelHeader title={copy.orderHeading} level={3} />
        {order.length === 0 ? (
          <EmptyState
            icon="film"
            size="sm"
            inset
            title={copy.emptyOrder.title}
            hint={copy.emptyOrder.hint}
          />
        ) : (
          <ol className="flex flex-col gap-[var(--space-1)]">
            {order.map((row, index) =>
              row.kind === "clip" ? (
                <li
                  key={`clip-${row.id}`}
                  className="flex min-w-0 items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)]"
                >
                  <Icon
                    name="film"
                    size={14}
                    className="text-[color:var(--text-muted)]"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
                      {row.title}
                    </span>
                    <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                      {row.subtitle}
                    </span>
                  </span>
                </li>
              ) : (
                <SceneRow
                  key={`scene-${row.id}`}
                  row={row}
                  collectionId={collectionId}
                  first={index === 0}
                  last={index === order.length - 1}
                  pending={pending}
                  formAction={formAction}
                />
              ),
            )}
          </ol>
        )}
      </div>
    </Card>
  );
}

/** One scene in the running order, with its hold time and its moves. */
function SceneRow({
  row,
  collectionId,
  first,
  last,
  pending,
  formAction,
}: {
  row: Extract<RunningOrderRow, { kind: "scene" }>;
  collectionId: string;
  first: boolean;
  last: boolean;
  pending: boolean;
  formAction: (formData: FormData) => void;
}) {
  const hidden = (
    <>
      <input type="hidden" name="collectionId" value={collectionId} />
      <input type="hidden" name="entryId" value={row.id} />
    </>
  );
  return (
    <li className="flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)]">
      <Icon name="columns-2" size={14} className="text-[color:var(--accent)]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] text-[color:var(--text-primary)]">
          {row.name}
        </span>
        <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {row.detail}
        </span>
      </span>
      {row.still && (
        <form action={formAction}>
          {hidden}
          <input type="hidden" name="intent" value="hold" />
          <Select
            name="holdS"
            aria-label={`${copy.holdLabel}: ${row.name}`}
            defaultValue={String(row.holdS)}
            disabled={pending}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            options={SCENE_HOLD_SECONDS.map((seconds) => ({
              value: String(seconds),
              label: `${copy.holdLabel} ${copy.holdOption(seconds)}`,
            }))}
          />
        </form>
      )}
      <div className="flex items-center">
        {(
          [
            ["up", "chevron-up", copy.moveUp(row.name), first],
            ["down", "chevron-down", copy.moveDown(row.name), last],
            ["remove", "trash-2", copy.remove(row.name), false],
          ] as const
        ).map(([intent, icon, label, blocked]) => (
          <form key={intent} action={formAction}>
            {hidden}
            <input type="hidden" name="intent" value={intent} />
            <IconButton
              type="submit"
              name={icon}
              label={label}
              disabled={pending || blocked}
            />
          </form>
        ))}
      </div>
    </li>
  );
}
