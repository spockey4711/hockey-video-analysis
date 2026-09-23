import { reportsContent } from "./content";

import { Heading } from "@/components/core/Heading";
import { Icon } from "@/components/core/Icon";
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
    <header className="flex flex-wrap items-end justify-between gap-[var(--space-4)]">
      <div className="flex min-w-0 flex-col gap-[var(--space-1)]">
        <Heading level={1}>{team.title}</Heading>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {summary ? summary.facts.join(" · ") : team.subtitle}
        </p>
      </div>
      {summary ? (
        <a
          href={summary.csvHref}
          download
          className={buttonClassName({ variant: "primary" })}
        >
          <Icon name="download" size={BUTTON_ICON_SIZE.md} />
          {reportsContent.download}
        </a>
      ) : null}
    </header>
  );
}
