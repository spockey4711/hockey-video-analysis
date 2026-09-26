import { reportsContent } from "./content";

import { Icon } from "@/components/core/Icon";
import { PageHeader } from "@/components/core/PageHeader";
import { BUTTON_ICON_SIZE, buttonClassName } from "@/components/forms";

export interface TeamReportHeaderProps {
  /**
   * The facts under the title (the range and the game count, already
   * formatted) and the CSV link for the same range, or `null` in the loading
   * frame, which then shows the subtitle and no action.
   */
  readonly summary: {
    readonly facts: readonly string[];
    readonly csvHref: string;
  } | null;
}

const { team } = reportsContent;

/**
 * Header of the team overview: the title, which games the figures cover, and
 * the CSV download for exactly those games. The download is a plain anchor to
 * the export route handler (a file response, not a page), styled as the
 * primary button, like on the game report.
 */
export function TeamReportHeader({ summary }: TeamReportHeaderProps) {
  return (
    <PageHeader
      title={team.title}
      subtitle={summary ? summary.facts.join(" · ") : team.subtitle}
      actions={
        summary ? (
          <a
            href={summary.csvHref}
            download
            className={buttonClassName({ variant: "primary" })}
          >
            <Icon name="download" size={BUTTON_ICON_SIZE.md} />
            {reportsContent.download}
          </a>
        ) : null
      }
    />
  );
}
