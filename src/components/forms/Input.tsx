"use client";

import { type InputHTMLAttributes, type Ref, useId } from "react";

import { cn } from "../core/cn";
import { Icon, type IconName } from "../core/Icon";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Glyph shown inside the field, before the text. */
  leading?: IconName;
  /** Error message; also sets the invalid state. Takes precedence over `hint`. */
  error?: string;
  /** Helper text shown when there is no error. */
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

const LABEL_CLASS =
  "text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] uppercase tracking-[var(--ls-wide)] text-[color:var(--text-secondary)]";

/** Text field with an optional label, leading icon and hint/error line. */
export function Input({
  label,
  leading,
  error,
  hint,
  id,
  className,
  ...rest
}: InputProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const messageId = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      {label && (
        <label htmlFor={inputId} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      <div className="relative">
        {leading && (
          <Icon
            name={leading}
            size={16}
            className="pointer-events-none absolute top-1/2 left-[var(--space-3)] -translate-y-1/2 text-[color:var(--text-muted)]"
          />
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={cn(
            "h-[var(--control-md)] w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-inset)] px-[var(--space-3)] text-[length:var(--fs-body)] text-[color:var(--text-primary)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] placeholder:text-[color:var(--text-muted)] focus-visible:border-[color:var(--border-focus)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            leading && "pl-[var(--space-8)]",
            error &&
              "border-[color:var(--danger)] focus-visible:border-[color:var(--danger)]",
            className,
          )}
          {...rest}
        />
      </div>
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
