"use client";

import { startTransition, useActionState, useState } from "react";

import { saveTagWindowsAction, type TagWindowsFormState } from "./actions";
import { tagWindowsContent } from "./content";
import {
  RESET_INTENT,
  isDefaultTagWindows,
  tagWindowField,
  tagWindowValues,
  type TagWindowField,
  type TagWindowValues,
} from "./form";

import { cn } from "@/components/core/cn";
import { TagChip } from "@/components/data/TagChip";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { FIELD_LABEL_CLASS } from "@/components/forms/field-label";
import { keepValuesOnSubmit } from "@/components/forms/keep-values-on-submit";
import {
  DEFAULT_TAG_WINDOWS,
  MAX_POST_S,
  MAX_PRE_S,
  MIN_POST_S,
  MIN_PRE_S,
  TAG_TYPES,
  type TagWindows,
} from "@/lib/tag-types";

const content = tagWindowsContent;
const initialState: TagWindowsFormState = {};
const DEFAULT_VALUES = tagWindowValues(DEFAULT_TAG_WINDOWS);

/** The columns a type's row and the header share: the type, then both edges. */
const ROW_GRID =
  "grid-cols-2 items-start gap-x-[var(--space-3)] gap-y-[var(--space-2)] sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:gap-x-[var(--space-4)]";

function sameValues(a: TagWindowValues, b: TagWindowValues): boolean {
  return TAG_TYPES.every(
    ({ key }) =>
      a[tagWindowField(key, "preS")] === b[tagWindowField(key, "preS")] &&
      a[tagWindowField(key, "postS")] === b[tagWindowField(key, "postS")],
  );
}

export interface TagWindowsFormProps {
  /** The windows the team captures with, as stored. */
  readonly windows: TagWindows;
}

/**
 * The team's clip window per tag type on the settings page: a lead-in and a
 * follow-through in whole seconds for each type, with the type's default
 * beside it. "Zurücksetzen" puts every type back on its default. A save only
 * changes new captures; tags already made keep their window.
 */
export function TagWindowsForm({ windows }: TagWindowsFormProps) {
  const [state, formAction, pending] = useActionState(
    saveTagWindowsAction,
    initialState,
  );
  const onSubmit = keepValuesOnSubmit(formAction);

  // Follow the stored windows whenever the page re-renders with new ones (after
  // a save or a reset), but keep what the coach typed through a failed save.
  const stored = tagWindowValues(windows);
  const [values, setValues] = useState<TagWindowValues>(stored);
  const [synced, setSynced] = useState<TagWindowValues>(stored);
  if (!sameValues(synced, stored)) {
    setSynced(stored);
    setValues(stored);
  }

  const canReset =
    !isDefaultTagWindows(windows) || !sameValues(values, DEFAULT_VALUES);

  function onReset(): void {
    setValues(DEFAULT_VALUES);
    const data = new FormData();
    data.set("intent", RESET_INTENT);
    startTransition(() => formAction(data));
  }

  function setField(field: TagWindowField, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="flex flex-col gap-[var(--space-4)]"
      noValidate
    >
      <FormStatus state={state} />
      <div className="flex flex-col gap-[var(--space-4)] sm:max-w-[36rem] sm:gap-[var(--space-2)]">
        {/* One column header on wider screens; a phone labels each field. */}
        <div aria-hidden="true" className={cn(ROW_GRID, "hidden sm:grid")}>
          <span />
          <span className={FIELD_LABEL_CLASS}>{content.preLabel}</span>
          <span className={FIELD_LABEL_CLASS}>{content.postLabel}</span>
        </div>
        <ul className="flex flex-col gap-[var(--space-4)] sm:gap-[var(--space-3)]">
          {TAG_TYPES.map((type) => {
            const pre = tagWindowField(type.key, "preS");
            const post = tagWindowField(type.key, "postS");
            return (
              <li key={type.key} className={cn(ROW_GRID, "grid")}>
                <div className="col-span-2 flex min-h-[var(--control-md)] flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] sm:col-span-1">
                  <TagChip type={type.key} />
                  <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                    {content.defaultHint(type.window)}
                  </span>
                </div>
                <WindowInput
                  name={pre}
                  label={content.preLabel}
                  typeLabel={type.label}
                  min={MIN_PRE_S}
                  max={MAX_PRE_S}
                  value={values[pre]}
                  error={state.fieldErrors?.[pre]}
                  onChange={(value) => setField(pre, value)}
                />
                <WindowInput
                  name={post}
                  label={content.postLabel}
                  typeLabel={type.label}
                  min={MIN_POST_S}
                  max={MAX_POST_S}
                  value={values[post]}
                  error={state.fieldErrors?.[post]}
                  onChange={(value) => setField(post, value)}
                />
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-[var(--space-3)]">
        <Button type="submit" disabled={pending}>
          {pending ? content.submitting : content.submit}
        </Button>
        <Button
          variant="secondary"
          disabled={pending || !canReset}
          title={content.resetHint}
          onClick={onReset}
        >
          {content.reset}
        </Button>
      </div>
    </form>
  );
}

/**
 * One edge of a type's window. A phone shows the field's own label above it;
 * wider screens show the column header instead. The accessible name always
 * names the type too ("Tor: Vorlauf (s)").
 */
function WindowInput({
  name,
  label,
  typeLabel,
  min,
  max,
  value,
  error,
  onChange,
}: {
  name: TagWindowField;
  label: string;
  typeLabel: string;
  min: number;
  max: number;
  value: string | undefined;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-1)]">
      <span aria-hidden="true" className={cn(FIELD_LABEL_CLASS, "sm:hidden")}>
        {label}
      </span>
      <Input
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        aria-label={content.fieldName(typeLabel, label)}
        value={value ?? ""}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** The form's outcome above its fields; field errors show at their fields. */
function FormStatus({ state }: { state: TagWindowsFormState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-[var(--radius-md)] border border-[color:var(--danger)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-[var(--radius-md)] border border-[color:var(--accent)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]"
      >
        {state.success === "reset" ? content.resetSuccess : content.success}
      </p>
    );
  }
  return null;
}
