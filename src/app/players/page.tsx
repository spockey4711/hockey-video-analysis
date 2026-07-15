import type { Metadata } from "next";

import { PlayerRoster, RosterHeader } from "@/components/players";
import { requireCoach } from "@/features/access";
import { listPlayers, rosterContent } from "@/features/players/roster";

// Coach-only workspace holding secret share links; keep it out of search indexes.
export const metadata: Metadata = {
  title: rosterContent.title,
  robots: { index: false, follow: false },
};

/**
 * The roster: every team player with their secret share link and the coach-only
 * controls to rotate that link or erase the player and their data (P1-6).
 */
export default async function PlayersPage() {
  await requireCoach("/players");
  const players = await listPlayers();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <RosterHeader />
      <PlayerRoster
        players={players}
        baseUrl={process.env.NEXT_PUBLIC_APP_URL}
      />
    </main>
  );
}
