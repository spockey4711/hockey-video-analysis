import { GamesHeader } from "@/components/games/GamesHeader";
import { GamesListSkeleton } from "@/components/games/GamesListSkeleton";

/**
 * Route-level loading fallback for the games list. Reuses the real header so the
 * frame stays put and swaps only the list body for a pulsing skeleton while
 * `listGames()` resolves.
 */
export default function GamesLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <GamesHeader />
      <GamesListSkeleton />
    </main>
  );
}
