import { reportsContent } from "./content";

/** Number of headline tiles: one per default tag type plus the total. */
const TILE_COUNT = 5;

/**
 * Loading placeholder for the report body: pulsing tiles and two table panels
 * that match the real report's footprint, so the frame does not jump when the
 * figures resolve. Server-rendered as the route's `loading.tsx` fallback.
 */
export function ReportSkeleton() {
  return (
    <div
      role="status"
      aria-label={reportsContent.loading}
      className="flex animate-pulse flex-col gap-[var(--space-6)]"
    >
      <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-5">
        {Array.from({ length: TILE_COUNT }, (_, index) => (
          <div
            key={index}
            className="flex h-[var(--space-20)] flex-col justify-between rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface)] p-[var(--space-4)] shadow-[var(--shadow-sm)] last:col-span-2 sm:last:col-span-1"
          >
            <span className="h-[var(--space-3)] w-2/3 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
            <span className="h-[var(--space-6)] w-1/3 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
          </div>
        ))}
      </div>
      {[0, 1].map((panel) => (
        <div
          key={panel}
          className="flex h-[calc(var(--space-20)*2)] flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface)] p-[var(--space-5)] shadow-[var(--shadow-sm)]"
        >
          <span className="h-[var(--space-3)] w-1/4 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
          <span className="h-[var(--space-3)] w-1/2 rounded-[var(--radius-sm)] bg-[var(--surface-inset)]" />
        </div>
      ))}
    </div>
  );
}
