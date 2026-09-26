"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

import { pickerContent } from "./content";

import { Heading } from "@/components/core/Heading";
import { IconButton } from "@/components/forms/IconButton";

export interface PickerDialogProps {
  readonly open: boolean;
  /** Called when the coach closes it: the close button, Escape or a click beside it. */
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * A modal dialog over the clip editor, on the native `<dialog>`: the browser
 * keeps focus inside it, closes it on Escape and makes the page behind it
 * inert. Its content mounts only while it is open, so it loads fresh each
 * time, and focus starts on the element marked `data-autofocus` if any.
 */
export function PickerDialog({
  open,
  onClose,
  title,
  children,
}: PickerDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The browser focuses the first control, the close button; a form
      // inside names the field to start in instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // The panel fills the dialog, so a click on the dialog itself is one on
      // the backdrop beside it.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[min(90dvh,48rem)] w-[min(100%-2*var(--space-4),40rem)] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[var(--surface-raised)] text-[color:var(--text-primary)] shadow-[var(--shadow-lg)] backdrop:bg-[var(--scrim)]"
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-center gap-[var(--space-3)] border-b border-[color:var(--border)] px-[var(--space-4)] py-[var(--space-3)]">
          <Heading level={2} size="sub" id={titleId}>
            {title}
          </Heading>
          <IconButton
            name="x"
            label={pickerContent.picker.close}
            onClick={onClose}
            className="ms-auto"
          />
        </header>
        {open ? children : null}
      </div>
    </dialog>
  );
}
