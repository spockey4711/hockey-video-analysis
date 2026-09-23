import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/components/core/Card";
import { EmptyState } from "@/components/core/EmptyState";
import { requireCoach } from "@/features/access";
import {
  buildGameReport,
  playerBreakdownRows,
  quarterBreakdownRows,
  ReportBreakdownTable,
  ReportFigures,
  ReportHeader,
  reportGameLine,
  reportsContent,
} from "@/features/reports";
import { loadGameReportData } from "@/features/reports/queries";

const { quarters, players, table, empty } = reportsContent;

// Coach-only analysis surface; keep it out of search indexes.
export const metadata: Metadata = {
  title: reportsContent.title,
  robots: { index: false, follow: false },
};

/**
 * The per-game overview report (P2-12): the game's key figures - goals, short
 * corners, good and bad actions - counted from its existing tags, split by
 * quarter and by linked player, with a CSV export. Coach-only, like the rest of
 * the games workspace; an unknown game id 404s.
 */
export default async function GameReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCoach(`/games/${id}/report`);

  const data = await loadGameReportData(id);
  if (!data) notFound();

  const report = buildGameReport(data);
  const quarterRows = quarterBreakdownRows(report);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-10)]">
      <ReportHeader game={{ id: data.game.id, ...reportGameLine(data.game) }} />

      {report.totals.total === 0 ? (
        <Card className="p-[var(--space-8)]">
          <EmptyState icon="tag" title={empty.title} hint={empty.hint} />
        </Card>
      ) : (
        <>
          <ReportFigures totals={report.totals} />
          <ReportBreakdownTable
            title={quarters.heading}
            hint={quarters.hint}
            rowHeader={table.quarter}
            rows={quarterRows ?? []}
            empty={
              <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                {quarters.notSet}
              </p>
            }
          />
          <ReportBreakdownTable
            title={players.heading}
            hint={players.hint}
            rowHeader={table.player}
            rows={playerBreakdownRows(report)}
          />
        </>
      )}
    </main>
  );
}
