"use client";

import Link from "next/link";
import { useActionState } from "react";

import { sceneMutationInitialState } from "../state";

import { executionAction } from "./actions";
import { executionsContent } from "./content";
import type { ExecutionRowView } from "./items";
import {
  EXECUTION_OUTCOMES,
  type ExecutionOutcome,
  type ExecutionStats,
  successRate,
} from "./outcome";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { Icon } from "@/components/core/Icon";
import { PanelHeader } from "@/components/core/PanelHeader";
import { cn } from "@/components/core/cn";
import { StatusBadge } from "@/components/data";
import { IconButton } from "@/components/forms/IconButton";
import { Select } from "@/components/forms/Select";
import { buttonClassName } from "@/components/forms/button-styles";

const { scene: copy, summary, outcomes } = executionsContent;

/** The dot beside each outcome, so a list of them reads at a glance. */
const OUTCOME_DOT: Record<ExecutionOutcome, string> = {
  success: "bg-[var(--success)]",
  failure: "bg-[var(--danger)]",
  open: "bg-[var(--text-muted)]",
};

export interface SceneExecutionsProps {
  readonly sceneId: string;
  readonly stats: ExecutionStats;
  /** The executions in play order. */
  readonly rows: readonly ExecutionRowView[];
  /** How many of them have a ready clip to play. */
  readonly playable: number;
}

/**
 * Plan vs reality under the board: how often the team played the scene and
 * how often it worked, the tagged moments linked to it with their outcome
 * for the coach to rate or unlink, and the way to link more or to watch them
 * one after another. Every change is its own small form on one action, saved
 * as it is made.
 */
export function SceneExecutions({
  sceneId,
  stats,
  rows,
  playable,
}: SceneExecutionsProps) {
  const [state, formAction, pending] = useActionState(
    executionAction,
    sceneMutationInitialState,
  );
  const rate = successRate(stats);

  return (
    <Card
      as="section"
      aria-labelledby="executions-heading"
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]"
    >
      <PanelHeader
        titleId="executions-heading"
        title={
          <span className="inline-flex items-center gap-[var(--space-2)]">
            <Icon name="chart-column" size={14} />
            {copy.heading}
          </span>
        }
        hint={copy.description}
      />

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        {playable > 0 && (
          <Link
            href={`/tactics/${sceneId}/executions`}
            className={buttonClassName({ variant: "primary", size: "sm" })}
          >
            <Icon name="play" size={14} />
            {copy.watch}
          </Link>
        )}
        <Link
          href={`/tactics/${sceneId}/executions/link`}
          className={buttonClassName({ variant: "secondary", size: "sm" })}
        >
          <Icon name="link" size={14} />
          {copy.link}
        </Link>
      </div>

      {stats.total > 0 && (
        <div className="flex flex-wrap items-end gap-[var(--space-3)]">
          <dl className="flex gap-[var(--space-3)]">
            <Figure label={copy.heading} value={String(stats.total)} />
            <Figure
              label={summary.rateLabel}
              value={rate === null ? "-" : `${rate} %`}
            />
          </dl>
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
            {summary.breakdown(stats.success, stats.failure, stats.open)}
            {stats.open > 0 && `. ${summary.rateHint}`}
          </p>
        </div>
      )}

      {state.status === "error" && state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="tag"
          size="sm"
          inset
          title={copy.empty.title}
          hint={copy.empty.hint}
        />
      ) : (
        <ol className="flex flex-col gap-[var(--space-1)]">
          {rows.map((row) => (
            <ExecutionRow
              key={row.tagId}
              sceneId={sceneId}
              row={row}
              pending={pending}
              formAction={formAction}
            />
          ))}
        </ol>
      )}
    </Card>
  );
}

/** One headline figure of the executions. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[calc(var(--space-16)*2)] flex-col gap-[var(--space-1)] rounded-[var(--radius-md)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)]">
      <dt className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
        {label}
      </dt>
      <dd className="text-[length:var(--fs-h3)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)] tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/** One linked moment, with its clip's state, its outcome and its unlink. */
function ExecutionRow({
  sceneId,
  row,
  pending,
  formAction,
}: {
  sceneId: string;
  row: ExecutionRowView;
  pending: boolean;
  formAction: (formData: FormData) => void;
}) {
  const moment = `${row.title}, ${row.subtitle}`;
  const hidden = (
    <>
      <input type="hidden" name="sceneId" value={sceneId} />
      <input type="hidden" name="tagId" value={row.tagId} />
    </>
  );
  return (
    <li className="flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)]">
      <span
        aria-hidden="true"
        className={cn(
          "size-[var(--space-2)] shrink-0 rounded-full",
          OUTCOME_DOT[row.outcome],
        )}
      />
      <span className="flex min-w-0 flex-1 basis-[calc(var(--space-16)*3)] flex-col">
        <span className="truncate text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] text-[color:var(--text-primary)]">
          {row.title}
        </span>
        <span className="text-[length:var(--fs-caption)] break-words text-[color:var(--text-muted)]">
          {row.subtitle}
        </span>
      </span>
      {row.clipStatus === null ? (
        <span className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {copy.noClip}
        </span>
      ) : (
        row.clipStatus !== "ready" && <StatusBadge status={row.clipStatus} />
      )}
      <span className="ms-auto flex items-center gap-[var(--space-1)]">
        <form action={formAction}>
          {hidden}
          <input type="hidden" name="intent" value="outcome" />
          <Select
            name="outcome"
            aria-label={copy.outcomeLabel(moment)}
            // Keyed on the stored outcome, so a refused change snaps back.
            key={row.outcome}
            defaultValue={row.outcome}
            disabled={pending}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="h-[var(--control-sm)] text-[length:var(--fs-body-sm)]"
            options={EXECUTION_OUTCOMES.map((outcome) => ({
              value: outcome,
              label: outcomes[outcome],
            }))}
          />
        </form>
        <form action={formAction}>
          {hidden}
          <input type="hidden" name="intent" value="unlink" />
          <IconButton
            type="submit"
            name="x"
            size="sm"
            label={copy.unlink(moment)}
            disabled={pending}
          />
        </form>
      </span>
    </li>
  );
}
