import Link from "next/link";

import { reportsContent } from "./content";

import { Icon } from "@/components/core/Icon";
import { PageHeader } from "@/components/core/PageHeader";
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
    <PageHeader
      back={{ href: "/games", label: reportsContent.back }}
      title={reportsContent.title}
      subtitle={
        game ? (
          <>
            <span className="[font-weight:var(--fw-semibold)] text-[color:var(--text-secondary)]">
              {game.name}
            </span>
            {game.meta.map((part) => (
              <span key={part}>{` · ${part}`}</span>
            ))}
          </>
        ) : (
          reportsContent.subtitle
        )
      }
      actions={
        game ? (
          <>
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
          </>
        ) : null
      }
    />
  );
}
