import { PageContainer } from "@/components/core/PageContainer";
import { ReportSkeleton, TeamReportHeader } from "@/features/reports";

/**
 * Route-level loading fallback for the team overview: the page frame with the
 * header's subtitle, and the pulsing report body while the figures load.
 */
export default function TeamReportLoading() {
  return (
    <PageContainer>
      <TeamReportHeader summary={null} />
      <ReportSkeleton />
    </PageContainer>
  );
}
