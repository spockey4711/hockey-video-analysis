import type { Metadata } from "next";

import { PageContainer } from "@/components/core/PageContainer";
import { PlayerRoster, RosterHeader } from "@/components/players";
import { requireCoach } from "@/features/access";
import { listPlayers, rosterContent } from "@/features/players/roster";
import { AddPlayerForm } from "@/features/players/setup";
import { TeamShareLink } from "@/features/share/team";

// Coach-only workspace holding secret share links; keep it out of search indexes.
export const metadata: Metadata = {
  title: rosterContent.title,
  robots: { index: false, follow: false },
};

/**
 * The roster: the coach adds and edits players here, and every team player is
 * listed with their secret share link and the coach-only controls to rotate that
 * link or erase the player and their data (P1-6).
 */
export default async function PlayersPage() {
  await requireCoach("/players");
  const players = await listPlayers();

  return (
    <PageContainer>
      <RosterHeader />
      <TeamShareLink baseUrl={process.env.NEXT_PUBLIC_APP_URL} />
      <AddPlayerForm />
      <PlayerRoster
        players={players}
        baseUrl={process.env.NEXT_PUBLIC_APP_URL}
      />
    </PageContainer>
  );
}
