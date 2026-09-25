import { cn } from "@/components/core/cn";

export interface TeamNoteProps {
  /** The coach's text for the team, plain text with its line breaks. */
  readonly text: string;
  readonly className?: string;
}

/**
 * The coach's text for the team under a clip or a collection heading on the
 * collection link: shown in full, line breaks kept, and set off by an accent
 * rule so it reads as a note rather than part of the clip's label. Shared by
 * the playlist, the share page intro and the title cards in presentation mode.
 */
export function TeamNote({ text, className }: TeamNoteProps) {
  return (
    <p
      className={cn(
        "border-l-2 border-[color:var(--accent)] pl-[var(--space-3)] leading-[var(--lh-body)] break-words whitespace-pre-line text-[color:var(--text-primary)]",
        className,
      )}
    >
      {text}
    </p>
  );
}
