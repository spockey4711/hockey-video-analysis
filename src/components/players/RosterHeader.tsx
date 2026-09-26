import { PageHeader } from "@/components/core/PageHeader";
import { rosterContent } from "@/features/players/roster";

/**
 * Header for the roster surface: the title and a one-line description of what
 * the page does. Shared by the roster page and its loading fallback so the two
 * frames do not jump. Presentational only.
 */
export function RosterHeader() {
  return (
    <PageHeader title={rosterContent.title} subtitle={rosterContent.subtitle} />
  );
}
