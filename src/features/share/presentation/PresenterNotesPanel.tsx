import { presentationContent } from "./content";
import type { PresenterNotesView } from "./presenter-notes";

import { Heading } from "@/components/core/Heading";
import { cn } from "@/components/core/cn";

export interface PresenterNotesPanelProps {
  /** The notes for the clip that is up (and the collection note on the first). */
  readonly notes: PresenterNotesView;
  /** Extra classes, e.g. to fill the presenter's console on a second screen. */
  readonly className?: string;
}

/**
 * The coach's private presenter notes beside the video in presentation mode:
 * the collection note on the first clip, then the current clip's note. It only
 * ever renders for a signed-in coach, as the share page passes notes in for
 * that session alone. Plain text keeps the coach's line breaks.
 */
export function PresenterNotesPanel({
  notes,
  className,
}: PresenterNotesPanelProps) {
  const copy = presentationContent.notes;

  return (
    <aside
      aria-label={copy.panelLabel}
      className={cn(
        "type-presentation flex w-[min(calc(16.5*var(--presentation-unit)),40%)] shrink-0 flex-col gap-[var(--space-3)] overflow-y-auto rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-3)]",
        className,
      )}
    >
      <p className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-muted)] uppercase">
        {copy.panelLabel}
      </p>
      {notes.collection && (
        <NoteBlock heading={copy.collectionHeading} text={notes.collection} />
      )}
      {notes.clip ? (
        <NoteBlock heading={copy.clipHeading} text={notes.clip} />
      ) : (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {copy.noClipNote}
        </p>
      )}
    </aside>
  );
}

function NoteBlock({ heading, text }: { heading: string; text: string }) {
  return (
    <section className="flex flex-col gap-[var(--space-1)]">
      <Heading level={2} size="eyebrow">
        {heading}
      </Heading>
      <p className="text-[length:var(--fs-body)] leading-[var(--lh-body)] break-words whitespace-pre-line text-[color:var(--text-primary)]">
        {text}
      </p>
    </section>
  );
}
