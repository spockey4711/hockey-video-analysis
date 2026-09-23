import { ReportHeader, ReportSkeleton } from "@/features/reports";

/**
 * Route-level loading fallback for the game report. Without it the parent
 * `/games` fallback (the games-list skeleton) would flash in instead; this keeps
 * the report's own frame and pulses only its body while the figures load.
 */
export default function GameReportLoading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <ReportHeader game={null} />
      <ReportSkeleton />
    </main>
  );
}
