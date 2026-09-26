import { collectionsContent } from "./content";
import type { CollectionInsights as Insights } from "./insights";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { PanelHeader } from "@/components/core/PanelHeader";
import { CommentCard } from "@/features/clips/comments/CommentCard";
import type { ViewCounts } from "@/features/share/views/stats";

const { insights: copy } = collectionsContent.coach;

const FIGURES: readonly { key: keyof ViewCounts; label: string }[] = [
  { key: "clicks", label: copy.clicks },
  { key: "fullViews", label: copy.fullViews },
  { key: "replays", label: copy.replays },
  { key: "uniqueViewers", label: copy.uniqueViewers },
];

/** The collection-wide figures as four tiles, two per row on a phone. */
function SummaryFigures({ counts }: { counts: ViewCounts }) {
  return (
    <dl
      aria-label={copy.summaryLabel}
      className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-4"
    >
      {FIGURES.map(({ key, label }) => (
        <div
          key={key}
          className="flex flex-col-reverse gap-[var(--space-1)] rounded-[var(--radius-md)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)]"
        >
          <dt className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
            {label}
          </dt>
          <dd className="text-[length:var(--fs-h3)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)] tabular-nums">
            {counts[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One clip's figures as a compact wrapping row. */
function ClipFigures({ title, counts }: { title: string; counts: ViewCounts }) {
  return (
    <dl
      aria-label={copy.clipFiguresLabel(title)}
      className="flex flex-wrap gap-x-[var(--space-4)] gap-y-[var(--space-1)] text-[length:var(--fs-caption)]"
    >
      {FIGURES.map(({ key, label }) => (
        <div key={key} className="flex items-baseline gap-[var(--space-1)]">
          <dt className="text-[color:var(--text-muted)]">{label}</dt>
          <dd className="[font-weight:var(--fw-semibold)] text-[color:var(--text-primary)] tabular-nums">
            {counts[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Read-only insights on a collection for the coach: how often its clips were
 * opened, watched to the end and replayed on the secret link, by how many
 * viewers (counted per day, ADR 0009), and what was commented on each clip.
 * A Server Component: the page fetches and shapes the data, this only renders.
 */
export function CollectionInsights({ insights }: { insights: Insights }) {
  return (
    <Card
      as="section"
      aria-label={copy.heading}
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]"
    >
      <PanelHeader title={copy.heading} hint={copy.description} />

      {insights.clips.length === 0 ? (
        <EmptyState
          icon="chart-column"
          size="sm"
          inset
          title={copy.noClips.title}
          hint={copy.noClips.hint}
        />
      ) : !insights.hasActivity ? (
        <EmptyState
          icon="chart-column"
          size="sm"
          inset
          title={copy.emptyTitle}
          hint={copy.emptyHint}
        />
      ) : (
        <>
          <div className="flex flex-col gap-[var(--space-2)]">
            <SummaryFigures counts={insights.summary} />
            <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
              {copy.uniqueViewersHint}
            </p>
          </div>

          <ul className="flex flex-col divide-y divide-[color:var(--border-subtle)]">
            {insights.clips.map((clip) => (
              <li
                key={clip.id}
                className="flex flex-col gap-[var(--space-2)] py-[var(--space-3)] first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  {/* eslint-disable-next-line no-restricted-syntax -- a body-size list-item title, below every Heading rung. */}
                  <h3 className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-medium)] text-[color:var(--text-primary)]">
                    {clip.title}
                  </h3>
                  <span className="truncate text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                    {clip.subtitle}
                  </span>
                </div>

                <ClipFigures title={clip.title} counts={clip.counts} />

                {clip.comments.length === 0 ? (
                  <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
                    {copy.noComments}
                  </p>
                ) : (
                  <div className="flex flex-col gap-[var(--space-1)]">
                    {/* eslint-disable-next-line no-restricted-syntax -- a body-size list-item label, below every Heading rung. */}
                    <h4 className="text-[length:var(--fs-caption)] [font-weight:var(--fw-medium)] text-[color:var(--text-secondary)]">
                      {copy.commentsHeading(clip.comments.length)}
                    </h4>
                    <ol className="flex flex-col gap-[var(--space-2)]">
                      {clip.comments.map((comment) => (
                        <CommentCard
                          key={comment.id}
                          author={comment.author}
                          body={comment.body}
                          createdAt={comment.createdAt}
                          date={comment.date}
                          isCoach={comment.isCoach}
                        />
                      ))}
                    </ol>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
