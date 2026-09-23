import { ReportSkeleton, TeamReportHeader } from "@/features/reports";

/**
 * Route-level loading fallback for the team overview: the page frame with the
 * header's subtitle, and the pulsing report body while the figures load.
 */
export default function TeamReportLoading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <TeamReportHeader summary={null} />
      <ReportSkeleton />
    </main>
  );
}
