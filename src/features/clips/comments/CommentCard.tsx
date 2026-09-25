import { commentsContent } from "./content";

import { Icon } from "@/components/core/Icon";
import { cn } from "@/components/core/cn";

export interface CommentCardProps {
  readonly author: string;
  readonly body: string;
  /** Creation time as ISO 8601, for the `<time>` element. */
  readonly createdAt: string;
  /** Formatted creation time shown to the reader. */
  readonly date: string;
  /** A coach comment: outlined in the accent and badged with the coach label. */
  readonly isCoach: boolean;
}

/**
 * One comment as a list item, shared by the read/write thread and the coach's
 * read-only collection insights so both show a coach comment the same way.
 * Hook-free, so it renders on the server and inside the client thread alike.
 */
export function CommentCard({
  author,
  body,
  createdAt,
  date,
  isCoach,
}: CommentCardProps) {
  return (
    <li
      className={cn(
        "flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)] border bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)]",
        isCoach
          ? "border-[color:var(--accent)]"
          : "border-[color:var(--border-subtle)]",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--space-3)] gap-y-0">
        <span className="flex min-w-0 items-baseline gap-[var(--space-2)]">
          <span className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-semibold)] break-words text-[color:var(--text-primary)]">
            {author}
          </span>
          {isCoach && (
            <span className="inline-flex shrink-0 items-center gap-[var(--space-1)] self-center rounded-[var(--radius-pill)] bg-[var(--accent)] px-[var(--space-2)] text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] text-[color:var(--accent-ink)]">
              <Icon name="pin" size={12} />
              {commentsContent.coachLabel}
            </span>
          )}
        </span>
        <time
          dateTime={createdAt}
          className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)] tabular-nums"
        >
          {date}
        </time>
      </div>
      <p className="text-[length:var(--fs-body-sm)] leading-[var(--lh-body)] break-words whitespace-pre-wrap text-[color:var(--text-secondary)]">
        {body}
      </p>
    </li>
  );
}
