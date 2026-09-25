import { cn } from "@/components/core/cn";
import { commentsContent } from "@/features/clips/comments/content";

export interface CoachCommentProps {
  /** The coach comment's body; the full text stays in the hover title. */
  readonly text: string;
  readonly className?: string;
}

/**
 * The coach's highlighted comment as a subtitle under a clip's title, clamped
 * to two lines and led by the coach label so it reads as the coach's note
 * rather than part of the clip's label. Shared by the playlist and the
 * presentation mode on the collection link.
 */
export function CoachComment({ text, className }: CoachCommentProps) {
  return (
    <p
      title={text}
      className={cn(
        "line-clamp-2 leading-[var(--lh-body)] break-words text-[color:var(--text-secondary)]",
        className,
      )}
    >
      <span className="[font-weight:var(--fw-semibold)] text-[color:var(--text-brand)]">
        {commentsContent.coachLabel}:
      </span>{" "}
      {text}
    </p>
  );
}
