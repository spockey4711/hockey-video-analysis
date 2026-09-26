import { PageContainer } from "@/components/core/PageContainer";
import { PlayerRosterSkeleton, RosterHeader } from "@/components/players";
import { TeamShareLink } from "@/features/share/team";

/**
 * Route-level loading fallback for the roster. Reuses the real header and the
 * (IO-free) team link so the frame stays put and swaps only the list body for a
 * pulsing skeleton while `listPlayers()` resolves.
 */
export default function PlayersLoading() {
  return (
    <PageContainer>
      <RosterHeader />
      <TeamShareLink baseUrl={process.env.NEXT_PUBLIC_APP_URL} />
      <PlayerRosterSkeleton />
    </PageContainer>
  );
}
