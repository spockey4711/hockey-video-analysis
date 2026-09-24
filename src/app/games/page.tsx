import type { Metadata } from "next";

import { GamesHeader } from "@/components/games/GamesHeader";
import { GamesList } from "@/components/games/GamesList";
import { IncomingGamesList } from "@/components/games/IncomingGamesList";
import { requireCoach } from "@/features/access";
import {
  gamesContent,
  listGames,
  partitionIncomingGames,
} from "@/features/games";

const { list } = gamesContent;

// Coach-only workspace; keep it out of search indexes.
export const metadata: Metadata = {
  title: list.title,
  robots: { index: false, follow: false },
};

/**
 * The coach's games, newest first, with a link to create the next one. Imported
 * games still waiting for review sit above them in the "Neu eingegangen" list
 * and only join the normal list once the coach accepts them (P2-18).
 */
export default async function GamesPage() {
  await requireCoach("/games");
  const { incoming, accepted } = partitionIncomingGames(await listGames());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <GamesHeader />
      <IncomingGamesList games={incoming} />
      <GamesList games={accepted} />
    </main>
  );
}
