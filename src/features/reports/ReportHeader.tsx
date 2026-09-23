import Link from "next/link";

import { reportsContent } from "./content";

import { Heading } from "@/components/core/Heading";
import { Icon } from "@/components/core/Icon";
import { BUTTON_ICON_SIZE, buttonClassName } from "@/components/forms";

export interface ReportHeaderProps {
  /**
   * The game line under the title (its name, opponent and date, already
   * formatted), or `null` in the loading frame, which then renders without
   * the game line and the actions.
   */
  readonly game: {
    readonly id: string;
    readonly name: string;
    readonly meta: readonly string[];
  } | null;
}

/**
 * Header of the game report: a back link to the games list, the title with the
 * game it reports on, and the two actions - back into the tagging workspace and
 * the CSV download. The download is a plain anchor to the export route handler
 * (a file response, not a page), styled as the primary button.
 */
export function ReportHeader({ game }: ReportHeaderProps) {
  return (
    <header className="flex flex-col gap-[var(--space-4)]">
      <div>
        <Link
          href="/games"
          className="inline-flex items-center gap-[var(--space-1)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)] underline-offset-2 hover:text-[color:var(--text-primary)] hover:underline"
        >
          <Icon name="chevron-left" size={14} />
          {reportsContent.back}
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-[var(--space-4)]">
        <div className="flex min-w-0 flex-col gap-[var(--space-1)]">
          <Heading level={1}>{reportsContent.title}</Heading>
          {game ? (
            <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
              <span className="[font-weight:var(--fw-semibold)] text-[color:var(--text-secondary)]">
                {game.name}
              </span>
              {game.meta.map((part) => (
                <span key={part}>{` · ${part}`}</span>
              ))}
            </p>
          ) : (
            <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
              {reportsContent.subtitle}
            </p>
          )}
        </div>
        {game ? (
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <Link
              href={`/games/${game.id}/watch`}
              className={buttonClassName({ variant: "secondary" })}
            >
              <Icon name="tag" size={BUTTON_ICON_SIZE.md} />
              {reportsContent.toTagging}
            </Link>
            <a
              href={`/games/${game.id}/report/csv`}
              download
              className={buttonClassName({ variant: "primary" })}
            >
              <Icon name="download" size={BUTTON_ICON_SIZE.md} />
              {reportsContent.download}
            </a>
          </div>
        ) : null}
      </div>
    </header>
  );
}
