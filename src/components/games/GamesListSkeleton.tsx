import { gamesContent } from "@/features/games";

const { list } = gamesContent;

/** Number of placeholder rows to show while the games list loads. */
const SKELETON_ROWS = 4;

/**
 * Loading placeholder for the games list: a handful of pulsing card-shaped rows
 * that match the real list's footprint so the frame does not jump when the games
 * resolve. Server-rendered as the route's `loading.tsx` fallback; no
 * interactivity.
 */
export function GamesListSkeleton() {
  return (
    <ul
      role="status"
      aria-label={list.loading}
      className="flex animate-pulse flex-col gap-[var(--space-3)]"
    >
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <li
          key={index}
          className="flex items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface)] p-[var(--space-4)] shadow-[var(--shadow-sm)]"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-2)]">
            <span className="h-[var(--space-4)] w-1/2 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
            <span className="h-[var(--space-3)] w-1/3 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
          </div>
          <span className="h-[var(--space-3)] w-[var(--space-12)] shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
        </li>
      ))}
    </ul>
  );
}
