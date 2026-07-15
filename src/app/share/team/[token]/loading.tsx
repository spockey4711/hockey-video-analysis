import { ShareLoading, ShareShell } from "@/features/share/shell";
import { teamShareContent } from "@/features/share/team";

/**
 * Route-level fallback while the team clips load. Renders the same nav-free
 * {@link ShareShell} frame as the page so the surface does not jump between the
 * loading and loaded states.
 */
export default function TeamShareLoading() {
  return (
    <ShareShell title={teamShareContent.page.title}>
      <ShareLoading />
    </ShareShell>
  );
}
