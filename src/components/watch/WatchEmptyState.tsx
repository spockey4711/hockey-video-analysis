export interface WatchEmptyStateProps {
  /** The message explaining why there is nothing to play. */
  readonly message: string;
}

/**
 * Shown in the player region when a game has no video material (UX-6). Purely
 * presentational; the caller supplies the localized message.
 */
export function WatchEmptyState({ message }: WatchEmptyStateProps) {
  return (
    <p className="rounded-[var(--radius-lg)] bg-[var(--surface-inset)] p-[var(--space-6)] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
      {message}
    </p>
  );
}
