"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createGameAction, type GameFormState } from "./actions";
import { gamesContent } from "./content";
import { formatDuration } from "./format";
import { readMediaDuration } from "./read-media-duration";

import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { Input } from "@/components/forms/Input";
import { resolveSourceUrl } from "@/features/player/player-sources";

const { create } = gamesContent;
const initialState: GameFormState = {};

/** How long a path must stay unchanged before its file is read. */
const PROBE_DEBOUNCE_MS = 400;

/** Where a row's length stands: read from the file, never typed. */
type DurationProbe =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "ready"; durationS: number }
  | { status: "failed" };

/** A single editable chapter row in the form's controlled source list. */
interface SourceRow {
  /** Stable React key; rows are removable, so the index is not one. */
  id: number;
  filePath: string;
  probe: DurationProbe;
}

const idleProbe: DurationProbe = { status: "idle" };

export interface GameFormProps {
  /**
   * Root the player loads chapters from (the proxy root when configured), so
   * each length is read from the very file the player will play.
   */
  mediaBaseUrl?: string;
}

/**
 * Create-game form: title/date/opponent plus a dynamic, ordered list of chapter
 * files. The coach enters only each chapter's path; its length is read from the
 * file's metadata in the browser and submitted in a hidden field, which the
 * server validates like any other input. The source rows are React-controlled
 * so their values (and server-side per-row errors) survive the action
 * round-trip; row order is submit order, which becomes
 * `game_sources.order_index`.
 */
export function GameForm({ mediaBaseUrl }: GameFormProps) {
  const [state, formAction, pending] = useActionState(
    createGameAction,
    initialState,
  );
  const nextId = useRef(1);
  const [rows, setRows] = useState<SourceRow[]>([
    { id: 0, filePath: "", probe: idleProbe },
  ]);

  function updateRow(id: number, patch: Partial<SourceRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    const id = nextId.current;
    nextId.current += 1;
    setRows((current) => [...current, { id, filePath: "", probe: idleProbe }]);
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  const rowErrors = state.fieldErrors?.sourceRows ?? {};
  const reading = rows.some((row) => row.probe.status === "reading");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-[var(--space-6)]"
      noValidate
    >
      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-[var(--space-4)]">
        <Input
          name="title"
          label={create.titleLabel}
          placeholder={create.titlePlaceholder}
          error={state.fieldErrors?.title}
          autoComplete="off"
          required
        />
        <div className="grid gap-[var(--space-4)] sm:grid-cols-2">
          <Input
            name="opponent"
            label={create.opponentLabel}
            placeholder={create.opponentPlaceholder}
            error={state.fieldErrors?.opponent}
            autoComplete="off"
          />
          <Input
            name="playedOn"
            type="date"
            label={create.playedOnLabel}
            error={state.fieldErrors?.playedOn}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-[var(--space-3)]">
        <legend className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-secondary)] uppercase">
          {create.sourcesHeading}
        </legend>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {create.sourcesHint}
        </p>
        {state.fieldErrors?.sources && (
          <p
            role="alert"
            className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
          >
            {state.fieldErrors.sources}
          </p>
        )}

        <ol className="flex flex-col gap-[var(--space-3)]">
          {rows.map((row, index) => (
            <ChapterRow
              key={row.id}
              index={index}
              row={row}
              mediaBaseUrl={mediaBaseUrl}
              pathError={rowErrors[index]?.filePath}
              durationError={rowErrors[index]?.durationS}
              removable={rows.length > 1}
              onPathChange={(filePath) => updateRow(row.id, { filePath })}
              onProbe={(probe) => updateRow(row.id, { probe })}
              onRemove={() => removeRow(row.id)}
            />
          ))}
        </ol>

        <div>
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            {create.addSource}
          </Button>
        </div>
      </fieldset>

      <Button type="submit" full disabled={pending || reading}>
        {pending ? create.submitting : create.submit}
      </Button>
    </form>
  );
}

interface ChapterRowProps {
  index: number;
  row: SourceRow;
  mediaBaseUrl: string | undefined;
  pathError: string | undefined;
  durationError: string | undefined;
  removable: boolean;
  onPathChange: (filePath: string) => void;
  onProbe: (probe: DurationProbe) => void;
  onRemove: () => void;
}

/**
 * One chapter row. Reads the file's length whenever its path settles; a newer
 * path aborts the older read, so a late answer never lands on the wrong file.
 */
function ChapterRow({
  index,
  row,
  mediaBaseUrl,
  pathError,
  durationError,
  removable,
  onPathChange,
  onProbe,
  onRemove,
}: ChapterRowProps) {
  const path = row.filePath.trim();
  // The latest callback, read by the effect without re-running it per render.
  const onProbeRef = useRef(onProbe);
  useEffect(() => {
    onProbeRef.current = onProbe;
  });

  useEffect(() => {
    if (!path) {
      onProbeRef.current(idleProbe);
      return;
    }
    onProbeRef.current({ status: "reading" });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      readMediaDuration(
        resolveSourceUrl(path, mediaBaseUrl),
        controller.signal,
      ).then(
        (durationS) => onProbeRef.current({ status: "ready", durationS }),
        () => {
          if (!controller.signal.aborted) {
            onProbeRef.current({ status: "failed" });
          }
        },
      );
    }, PROBE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, mediaBaseUrl]);

  const { probe } = row;
  const unreadable =
    probe.status === "failed" ? create.durationUnreadable : undefined;

  return (
    <li className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] p-[var(--space-3)]">
      <span
        aria-hidden
        className="mt-[var(--space-2)] w-[var(--space-6)] shrink-0 text-center text-[length:var(--fs-body-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--text-muted)]"
      >
        {index + 1}
      </span>
      <div className="grid flex-1 gap-[var(--space-3)] sm:grid-cols-[1fr_7rem]">
        <Input
          name="sourcePath"
          label={create.pathLabel}
          placeholder={create.pathPlaceholder}
          value={row.filePath}
          onChange={(event) => onPathChange(event.target.value)}
          error={pathError ?? unreadable ?? durationError}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="flex flex-col gap-[var(--space-1)]">
          <span className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-secondary)] uppercase">
            {create.durationLabel}
          </span>
          <output
            aria-live="polite"
            aria-label={`${create.durationLabel} ${index + 1}`}
            className="flex h-[var(--control-md)] items-center text-[length:var(--fs-body)] text-[color:var(--text-primary)] tabular-nums"
          >
            {probe.status === "ready" ? (
              formatDuration(probe.durationS)
            ) : (
              <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                {probe.status === "reading"
                  ? create.durationPending
                  : create.durationEmpty}
              </span>
            )}
          </output>
          <input
            type="hidden"
            name="sourceDuration"
            value={probe.status === "ready" ? String(probe.durationS) : ""}
          />
        </div>
      </div>
      <IconButton
        type="button"
        name="trash-2"
        label={create.removeSource}
        variant="ghost"
        size="sm"
        className="mt-[var(--space-5)]"
        disabled={!removable}
        onClick={onRemove}
      />
    </li>
  );
}
