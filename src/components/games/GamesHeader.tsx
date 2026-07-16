import Link from "next/link";

import { Heading } from "@/components/core/Heading";
import { Button } from "@/components/forms/Button";
import { gamesContent } from "@/features/games";

const { list } = gamesContent;

/**
 * Header for the games surface: the list title and subtitle with the "new game"
 * action. Shared by the games page and its loading fallback so the two frames do
 * not jump. Presentational only.
 */
export function GamesHeader() {
  return (
    <header className="flex items-start justify-between gap-[var(--space-4)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <Heading level={1}>{list.title}</Heading>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {list.subtitle}
        </p>
      </div>
      <Link href="/games/new">
        <Button iconLeft="plus">{list.newGame}</Button>
      </Link>
    </header>
  );
}
