import { Heading } from "@/components/core/Heading";

export interface WatchHeaderProps {
  /** The game title, shown as the page heading. */
  readonly title: string;
  /**
   * Secondary facts (opponent, date). Falsy entries are dropped and the rest
   * joined with a middot, so the caller can pass optional values inline without
   * assembling the string itself.
   */
  readonly meta?: readonly (string | null | undefined | false)[];
}

/**
 * Watch-page heading (UX-6): the game title over a muted meta line. Purely
 * presentational - the caller formats the meta values (localized opponent
 * prefix, date), this only lays them out.
 */
export function WatchHeader({ title, meta }: WatchHeaderProps) {
  const items = (meta ?? []).filter((item): item is string => Boolean(item));

  return (
    <header className="flex flex-col gap-[var(--space-2)]">
      <Heading level={1}>{title}</Heading>
      {items.length > 0 ? (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {items.join(" · ")}
        </p>
      ) : null}
    </header>
  );
}
