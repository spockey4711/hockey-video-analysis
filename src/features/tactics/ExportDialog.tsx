"use client";

/**
 * The modal an export of the board opens in ("Als Bild", "Als Video"): a
 * titled panel with a close button, closed by Escape, the button or a click
 * beside it.
 *
 * It stops every key press it gets, so none reaches the board's keys or the
 * presentation the board may be open over.
 */
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Heading } from "@/components/core/Heading";
import { IconButton } from "@/components/forms/IconButton";

export function ExportDialog({
  title,
  closeLabel,
  open,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    // The board and the presentation listen further up; Escape is the
    // dialog's own, handled by the browser.
    event.stopPropagation();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onKeyDown={onKeyDown}
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
            label={closeLabel}
            onClick={onClose}
            className="ms-auto"
          />
        </header>
        {children}
      </div>
    </dialog>
  );
}
