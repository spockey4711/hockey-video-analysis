import { PlayerRosterSkeleton, RosterHeader } from "@/components/players";
import { TeamShareLink } from "@/features/share/team";

/**
 * Route-level loading fallback for the roster. Reuses the real header and the
 * (IO-free) team link so the frame stays put and swaps only the list body for a
 * pulsing skeleton while `listPlayers()` resolves.
 */
export default function PlayersLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <RosterHeader />
      <TeamShareLink baseUrl={process.env.NEXT_PUBLIC_APP_URL} />
      <PlayerRosterSkeleton />
    </main>
  );
}
