import { PageContainer } from "@/components/core/PageContainer";
import { ReportHeader, ReportSkeleton } from "@/features/reports";

/**
 * Route-level loading fallback for the game report. Without it the parent
 * `/games` fallback (the games-list skeleton) would flash in instead; this keeps
 * the report's own frame and pulses only its body while the figures load.
 */
export default function GameReportLoading() {
  return (
    <PageContainer>
      <ReportHeader game={null} />
      <ReportSkeleton />
    </PageContainer>
  );
}
