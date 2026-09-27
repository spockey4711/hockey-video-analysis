"use client";

import { useActionState, useState } from "react";

import { sceneRedirectInitialState } from "../state";

import { linkExecutionsAction } from "./actions";
import { executionsContent } from "./content";
import type { PickerRowView } from "./items";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { PanelHeader } from "@/components/core/PanelHeader";
import { cn } from "@/components/core/cn";
import { StatusBadge } from "@/components/data";
import { Button } from "@/components/forms/Button";

const { picker: copy, scene: sceneCopy } = executionsContent;

/**
 * The picker's checklist: the tagged moments the filter lists, the ones
 * already linked ticked and fixed, and one submit that links the ticked
 * ones and goes back to the scene. The form posts the ticked tag ids; the
 * action validates them all before anything is stored.
 */
export function ExecutionPicker({
  sceneId,
  rows,
}: {
  readonly sceneId: string;
  readonly rows: readonly PickerRowView[];
}) {
  const [state, formAction, pending] = useActionState(
    linkExecutionsAction,
    sceneRedirectInitialState,
  );
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());

  function toggle(tagId: string, on: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(tagId);
      else next.delete(tagId);
      return next;
    });
  }

  return (
    <Card
      as="section"
      aria-labelledby="picker-list-heading"
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]"
    >
      <PanelHeader
        titleId="picker-list-heading"
        title={copy.listHeading}
        hint={copy.defaultHint}
        action={
          <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {copy.count(rows.length)}
          </span>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon="search"
          size="sm"
          inset
          title={copy.none.title}
          hint={copy.none.hint}
        />
      ) : (
        <form
          action={formAction}
          className="flex flex-col gap-[var(--space-3)]"
        >
          <input type="hidden" name="sceneId" value={sceneId} />
          <ul className="flex flex-col gap-[var(--space-1)]">
            {rows.map((row) => (
              <li key={row.tagId}>
                <label
                  className={cn(
                    "flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] has-[:focus-visible]:shadow-[var(--glow-turf)]",
                    row.linked
                      ? "cursor-default opacity-70"
                      : "cursor-pointer hover:bg-[var(--surface-hover)]",
                  )}
                >
                  <input
                    type="checkbox"
                    name="tagId"
                    value={row.tagId}
                    checked={row.linked || chosen.has(row.tagId)}
                    disabled={row.linked || pending}
                    onChange={(event) =>
                      toggle(row.tagId, event.currentTarget.checked)
                    }
                    className="size-[var(--space-4)] shrink-0 accent-[var(--accent)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] text-[color:var(--text-primary)]">
                      {row.title}
                    </span>
                    <span className="text-[length:var(--fs-caption)] break-words text-[color:var(--text-muted)]">
                      {row.subtitle}
                    </span>
                  </span>
                  {row.linked ? (
                    <span className="shrink-0 text-[length:var(--fs-caption)] [font-weight:var(--fw-medium)] text-[color:var(--text-secondary)]">
                      {copy.linked}
                    </span>
                  ) : row.clipStatus === null ? (
                    <span className="shrink-0 text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                      {sceneCopy.noClip}
                    </span>
                  ) : (
                    row.clipStatus !== "ready" && (
                      <StatusBadge status={row.clipStatus} />
                    )
                  )}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-[var(--space-3)]">
            <Button
              type="submit"
              iconLeft="link"
              disabled={pending || chosen.size === 0}
            >
              {pending ? copy.submitting : copy.submit}
            </Button>
            <span
              role="status"
              className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]"
            >
              {copy.chosen(chosen.size)}
            </span>
          </div>
          {state.error && (
            <p
              role="alert"
              className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
            >
              {state.error}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
