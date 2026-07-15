import { rosterContent } from "@/features/players/roster";

/** Number of placeholder rows to show while the roster loads. */
const SKELETON_ROWS = 3;

/**
 * Loading placeholder for the roster: a few pulsing card-shaped rows that match
 * the real list's footprint so the frame does not jump when the players resolve.
 * Server-rendered as the route's `loading.tsx` fallback; no interactivity.
 */
export function PlayerRosterSkeleton() {
  return (
    <ul
      role="status"
      aria-label={rosterContent.loading}
      className="flex animate-pulse flex-col gap-[var(--space-3)]"
    >
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <li
          key={index}
          className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface)] p-[var(--space-4)] shadow-[var(--shadow-sm)]"
        >
          <span className="h-[var(--space-5)] w-1/3 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
          <span className="h-[var(--space-4)] w-2/3 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
          <span className="h-[var(--space-4)] w-1/4 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
        </li>
      ))}
    </ul>
  );
}
