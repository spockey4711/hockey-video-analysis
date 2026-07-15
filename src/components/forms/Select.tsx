"use client";

import { type Ref, type SelectHTMLAttributes, useId } from "react";

import { cn } from "../core/cn";
import { Icon } from "../core/Icon";

/** A plain value, or an explicit value/label pair. */
export type SelectOption = string | { value: string; label: string };

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  ref?: Ref<HTMLSelectElement>;
}

const LABEL_CLASS =
  "text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] uppercase tracking-[var(--ls-wide)] text-[color:var(--text-secondary)]";

/** Styled wrapper around a native `<select>` with a custom chevron. */
export function Select({
  label,
  options,
  id,
  className,
  ...rest
}: SelectProps) {
  const reactId = useId();
  const selectId = id ?? reactId;

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      {label && (
        <label htmlFor={selectId} className={LABEL_CLASS}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "h-[var(--control-md)] w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-inset)] pr-[var(--space-8)] pl-[var(--space-3)] text-[length:var(--fs-body)] text-[color:var(--text-primary)] transition duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:border-[color:var(--border-focus)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...rest}
        >
          {options.map((option) => {
            const { value, label: optionLabel } =
              typeof option === "string"
                ? { value: option, label: option }
                : option;
            return (
              <option key={value} value={value}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <Icon
          name="chevron-down"
          size={16}
          className="pointer-events-none absolute top-1/2 right-[var(--space-3)] -translate-y-1/2 text-[color:var(--text-muted)]"
        />
      </div>
    </div>
  );
}
