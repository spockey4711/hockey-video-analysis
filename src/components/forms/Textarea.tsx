"use client";

import { type Ref, type TextareaHTMLAttributes, useId } from "react";

import { cn } from "../core/cn";

import { FIELD_LABEL_CLASS } from "./field-label";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  /** Error message; also sets the invalid state. Takes precedence over `hint`. */
  error?: string;
  /** Helper text shown when there is no error. */
  hint?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Multi-line text field with an optional label and hint/error line. Mirrors
 * {@link Input}'s chrome so a form mixing both reads as one control set.
 */
export function Textarea({
  label,
  error,
  hint,
  id,
  className,
  rows = 3,
  ...rest
}: TextareaProps) {
  const reactId = useId();
  const textareaId = id ?? reactId;
  const messageId = error
    ? `${textareaId}-error`
    : hint
      ? `${textareaId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      {label && (
        <label htmlFor={textareaId} className={FIELD_LABEL_CLASS}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={cn(
          "w-full resize-y rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--fs-body)] leading-[var(--lh-body)] text-[color:var(--text-primary)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] placeholder:text-[color:var(--text-muted)] focus-visible:border-[color:var(--border-focus)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          error &&
            "border-[color:var(--danger)] focus-visible:border-[color:var(--danger)]",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p
          id={messageId}
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={messageId}
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
