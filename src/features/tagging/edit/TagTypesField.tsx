"use client";

/**
 * The types of one tagged moment in the tag edit form (ADR 0016): every
 * configured type as a chip the coach switches on or off, so a short corner
 * that ended in a goal is one tag - and one clip - with both. Native
 * checkboxes carry it, so each type is a tab stop that Space toggles and a
 * screen reader hears a labelled group of checkboxes; the chips are their
 * labels, filled while on. The form blocks saving while none is on. Opening
 * the form focuses the main type, so a keyboard coach starts at the types.
 */
import { tagEditContent } from "./content";

import { cn } from "@/components/core/cn";
import { TagChip } from "@/components/data/TagChip";
import { FIELD_LABEL_CLASS } from "@/components/forms/field-label";
import { TAG_TYPES } from "@/lib/tag-types";

export interface TagTypesFieldProps {
  /** The type keys switched on, in any order. */
  readonly selected: readonly string[];
  /** The tag's main type, focused when the field opens. */
  readonly mainType: string;
  readonly disabled?: boolean;
  readonly onChange: (next: string[]) => void;
}

export function TagTypesField({
  selected,
  mainType,
  disabled = false,
  onChange,
}: TagTypesFieldProps) {
  const none = selected.length === 0;

  return (
    <fieldset
      disabled={disabled}
      className="flex min-w-0 flex-col gap-[var(--space-2)]"
    >
      <legend className={cn(FIELD_LABEL_CLASS, "mb-[var(--space-2)]")}>
        {tagEditContent.typesLabel}
      </legend>
      <div className="flex flex-wrap gap-[var(--space-1)]">
        {TAG_TYPES.map((type) => {
          const on = selected.includes(type.key);
          return (
            // `relative` pins the visually hidden checkbox onto its chip, so
            // focusing it scrolls the chip into view, not some far ancestor edge.
            <label
              key={type.key}
              className="relative inline-flex min-h-[var(--control-md)] cursor-pointer items-center rounded-[var(--radius-pill)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:shadow-[var(--glow-turf)]"
            >
              <input
                type="checkbox"
                className="sr-only"
                autoFocus={type.key === mainType}
                checked={on}
                onChange={() =>
                  onChange(
                    on
                      ? selected.filter((key) => key !== type.key)
                      : [...selected, type.key],
                  )
                }
              />
              <TagChip type={type.key} solid={on} />
            </label>
          );
        })}
      </div>
      <p
        className={cn(
          "text-[length:var(--fs-body-sm)]",
          none
            ? "text-[color:var(--danger)]"
            : "text-[color:var(--text-muted)]",
        )}
      >
        {none ? tagEditContent.noType : tagEditContent.typesHint}
      </p>
    </fieldset>
  );
}
