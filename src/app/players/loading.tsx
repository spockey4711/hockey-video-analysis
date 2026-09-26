import { PageContainer } from "@/components/core/PageContainer";
import { PlayerRosterSkeleton, RosterHeader } from "@/components/players";
import { TeamShareLinkSkeleton } from "@/features/share/team";

/**
 * Route-level loading fallback for the roster. Reuses the real header and the
 * team link card's frame so the layout stays put and swaps the team link and
 * list body for pulsing skeletons while the page resolves.
 */
export default function PlayersLoading() {
  return (
    <PageContainer>
      <RosterHeader />
      <TeamShareLinkSkeleton />
      <PlayerRosterSkeleton />
    </PageContainer>
  );
}
