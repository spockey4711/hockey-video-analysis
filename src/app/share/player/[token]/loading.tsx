import { playerShareContent } from "@/features/share/player";
import { ShareLoading, ShareShell } from "@/features/share/shell";

/**
 * Route-level fallback while a player's clips load. Renders the same nav-free
 * {@link ShareShell} frame as the page so the surface does not jump between the
 * loading and loaded states.
 */
export default function PlayerShareLoading() {
  return (
    <ShareShell title={playerShareContent.page.title}>
      <ShareLoading />
    </ShareShell>
  );
}
