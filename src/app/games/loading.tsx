import { PageContainer } from "@/components/core/PageContainer";
import { GamesHeader } from "@/components/games/GamesHeader";
import { GamesListSkeleton } from "@/components/games/GamesListSkeleton";

/**
 * Route-level loading fallback for the games list. Reuses the real header so the
 * frame stays put and swaps only the list body for a pulsing skeleton while
 * `listGames()` resolves.
 */
export default function GamesLoading() {
  return (
    <PageContainer>
      <GamesHeader />
      <GamesListSkeleton />
    </PageContainer>
  );
}
