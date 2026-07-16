"use client";

import { type Ref, useId } from "react";

import { cn } from "../core/cn";

export interface SwitchProps {
  /** Current on/off state (controlled). */
  checked: boolean;
  /** Called with the next state when the user toggles. */
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Controlled binary on/off toggle. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className,
  ref,
}: SwitchProps) {
  const reactId = useId();
  const switchId = id ?? reactId;

  const control = (
    <button
      ref={ref}
      type="button"
      role="switch"
      id={switchId}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[var(--space-5)] w-[var(--space-10)] shrink-0 items-center rounded-[var(--radius-pill)] p-[var(--border-w-strong)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--accent)]" : "bg-[var(--surface-hover)]",
        !label && className,
      )}
    >
      <span
        className={cn(
          "size-[var(--space-4)] rounded-[var(--radius-pill)] bg-[var(--knob)] shadow-[var(--shadow-sm)] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          checked ? "translate-x-[var(--space-5)]" : "translate-x-0",
        )}
      />
    </button>
  );

  if (!label) return control;

  return (
    <label
      htmlFor={switchId}
      className={cn(
        "inline-flex items-center gap-[var(--space-2)] select-none",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      {control}
      <span className="text-[length:var(--fs-body)] text-[color:var(--text-body)]">
        {label}
      </span>
    </label>
  );
}
