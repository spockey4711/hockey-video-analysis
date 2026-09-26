import type { Metadata } from "next";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { PageContainer } from "@/components/core/PageContainer";
import { requireCoach } from "@/features/access";
import {
  buildTeamReport,
  gameBreakdownRows,
  isRangeSet,
  parseReportRange,
  playerBreakdownRows,
  ReportBreakdownTable,
  ReportFigures,
  ReportRangeForm,
  reportRangeLabel,
  reportRangeQuery,
  reportsContent,
  TeamReportHeader,
} from "@/features/reports";
import { loadTeamReportData } from "@/features/reports/queries";

const { team, table } = reportsContent;

// Coach-only analysis surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: team.title,
  robots: { index: false, follow: false },
};

/**
 * The team overview (P2-12): the per-game key figures summed over all games,
 * or over the games played in an optional date range, per game and per player,
 * with a CSV export of the same figures. Coach-only; games are a shared team
 * workspace, so every coach sees the same overview.
 */
export default async function TeamReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const range = parseReportRange(await searchParams);
  const query = reportRangeQuery(range);
  await requireCoach(`/reports${query}`);

  const report = buildTeamReport(await loadTeamReportData(range));
  const empty = isRangeSet(range) ? team.emptyInRange : team.empty;

  return (
    <PageContainer>
      <TeamReportHeader
        summary={{
          facts: [reportRangeLabel(range), team.gameCount(report.games.length)],
          csvHref: `/reports/csv${query}`,
        }}
      />
      <ReportRangeForm action="/reports" range={range} />

      {report.totals.total === 0 ? (
        <Card className="p-[var(--space-8)]">
          <EmptyState icon="tag" title={empty.title} hint={empty.hint} />
        </Card>
      ) : (
        <>
          <ReportFigures totals={report.totals} />
          <ReportBreakdownTable
            title={team.games.heading}
            hint={team.games.hint}
            rowHeader={team.table.game}
            rows={gameBreakdownRows(report)}
          />
          <ReportBreakdownTable
            title={team.players.heading}
            hint={team.players.hint}
            rowHeader={table.player}
            rows={playerBreakdownRows(report)}
          />
        </>
      )}
    </PageContainer>
  );
}
