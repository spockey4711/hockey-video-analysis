"use client";

import { useId } from "react";

import { Icon, type IconName } from "../core/Icon";
import { cn } from "../core/cn";

/** One option of a {@link ChoiceGroup}. */
export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: IconName;
}

export interface ChoiceGroupProps<T extends string> {
  /** The group's name, read out as the radio group's label. */
  label: string;
  /** Show the label above the options; otherwise it is for screen readers only. */
  showLabel?: boolean;
  options: readonly ChoiceOption<T>[];
  /** The selected option (controlled). */
  value: T;
  /** Called with the option the user picked. */
  onChange: (next: T) => void;
  className?: string;
}

const LABEL_CLASS =
  "text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] uppercase tracking-[var(--ls-wide)] text-[color:var(--text-secondary)]";

/**
 * A segmented single choice between a few options, such as System / Hell /
 * Dunkel. Native radio buttons carry it, so it is one tab stop, the arrow keys
 * move the choice and a screen reader hears a labelled radio group; the
 * segments are their styled labels. Wraps onto a second row on a narrow screen
 * or at a large text size rather than overflowing.
 */
export function ChoiceGroup<T extends string>({
  label,
  showLabel = true,
  options,
  value,
  onChange,
  className,
}: ChoiceGroupProps<T>) {
  const name = useId();

  return (
    <fieldset
      className={cn("flex min-w-0 flex-col gap-[var(--space-1)]", className)}
    >
      <legend
        className={
          showLabel ? cn(LABEL_CLASS, "mb-[var(--space-1)]") : "sr-only"
        }
      >
        {label}
      </legend>
      <div className="flex w-fit max-w-full flex-wrap gap-[var(--space-1)] rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[var(--surface-inset)] p-[var(--space-1)]">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex min-h-[var(--control-sm)] cursor-pointer items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)] text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none has-[:focus-visible]:shadow-[var(--glow-turf)]",
                checked
                  ? "bg-[var(--surface-raised)] text-[color:var(--text-primary)] shadow-[var(--shadow-sm)]"
                  : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.icon && <Icon name={option.icon} size={16} />}
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
