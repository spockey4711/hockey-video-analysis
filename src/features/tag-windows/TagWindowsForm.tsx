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

import { TagChip } from "@/components/data/TagChip";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
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
      <ul className="flex flex-col gap-[var(--space-4)]">
        {TAG_TYPES.map((type) => {
          const pre = tagWindowField(type.key, "preS");
          const post = tagWindowField(type.key, "postS");
          return (
            <li
              key={type.key}
              className="flex flex-col gap-[var(--space-2)] sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)_minmax(0,9rem)] sm:items-start sm:gap-[var(--space-4)]"
            >
              <div className="flex flex-col items-start gap-[var(--space-1)] sm:pt-[var(--space-6)]">
                <TagChip type={type.key} />
                <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                  {content.defaultHint(type.window)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-[var(--space-3)] sm:contents">
                <Input
                  name={pre}
                  type="number"
                  inputMode="numeric"
                  min={MIN_PRE_S}
                  max={MAX_PRE_S}
                  step={1}
                  label={content.preLabel}
                  aria-label={content.fieldName(type.label, content.preLabel)}
                  value={values[pre]}
                  error={state.fieldErrors?.[pre]}
                  onChange={(event) => setField(pre, event.target.value)}
                />
                <Input
                  name={post}
                  type="number"
                  inputMode="numeric"
                  min={MIN_POST_S}
                  max={MAX_POST_S}
                  step={1}
                  label={content.postLabel}
                  aria-label={content.fieldName(type.label, content.postLabel)}
                  value={values[post]}
                  error={state.fieldErrors?.[post]}
                  onChange={(event) => setField(post, event.target.value)}
                />
              </div>
            </li>
          );
        })}
      </ul>
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
