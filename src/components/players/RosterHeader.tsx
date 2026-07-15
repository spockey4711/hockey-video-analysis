import { rosterContent } from "@/features/players/roster";

/**
 * Header for the roster surface: the title and a one-line description of what
 * the page does. Shared by the roster page and its loading fallback so the two
 * frames do not jump. Presentational only.
 */
export function RosterHeader() {
  return (
    <header className="flex flex-col gap-[var(--space-1)]">
      <h1 className="text-[length:var(--fs-heading)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
        {rosterContent.title}
      </h1>
      <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {rosterContent.subtitle}
      </p>
    </header>
  );
}
