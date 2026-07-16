import { EmptyState } from "@/components/core/EmptyState";

export interface WatchEmptyStateProps {
  /** Short headline for why there is nothing to play. */
  readonly title: string;
  /** Optional one-line explanation under the title. */
  readonly hint?: string;
}

/**
 * Shown in the player region when a game has no video material (UX-6). Keeps the
 * inset player frame so the layout does not jump, and renders the shared
 * `EmptyState` block inside it; the caller supplies the localized copy.
 */
export function WatchEmptyState({ title, hint }: WatchEmptyStateProps) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-inset)] p-[var(--space-12)]">
      <EmptyState icon="film" title={title} hint={hint} />
    </div>
  );
}
