/**
 * `GET /games/:id/report/csv` - download a game's report figures as CSV
 * (P2-12). Coach-only: middleware already bounces a request without a session
 * cookie to the login page, and this handler is the authoritative check - it
 * validates the session against the database before reading anything.
 *
 * The body and file name come from the pure `gameReportCsv` /
 * `reportCsvFileName`, so this handler only authenticates, loads and responds.
 */
import { NextResponse } from "next/server";

import { loadGameReportData } from "@/features/reports/queries";
import { buildGameReport } from "@/features/reports/report";
import {
  gameReportCsv,
  reportCsvFileName,
} from "@/features/reports/report-csv";
import { getCurrentCoach } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await loadGameReportData(id);
  if (!data) {
    return NextResponse.json({ error: "game not found" }, { status: 404 });
  }

  const body = gameReportCsv(buildGameReport(data));
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // The file name is strictly [a-z0-9-].csv, so plain quoting is safe.
      "Content-Disposition": `attachment; filename="${reportCsvFileName(data.game)}"`,
      // Player names are coach data: never cache the export or let it be indexed.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
