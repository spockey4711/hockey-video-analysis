/**
 * `GET /reports/csv?from=&to=` - download the team overview as CSV (P2-12),
 * for the same optional date range as the page. Coach-only: middleware already
 * bounces a request without a session cookie to the login page, and this
 * handler is the authoritative check - it validates the session against the
 * database before reading anything.
 *
 * The body and file name come from the pure `teamReportCsv` /
 * `teamReportCsvFileName`, so this handler only authenticates, loads and
 * responds.
 */
import { NextResponse, type NextRequest } from "next/server";

import { loadTeamReportData } from "@/features/reports/queries";
import { parseReportRange } from "@/features/reports/report-range";
import { buildTeamReport } from "@/features/reports/team-report";
import {
  teamReportCsv,
  teamReportCsvFileName,
} from "@/features/reports/team-report-csv";
import { getCurrentCoach } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<Response> {
  const coach = await getCurrentCoach();
  if (!coach) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const range = parseReportRange({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const body = teamReportCsv(buildTeamReport(await loadTeamReportData(range)));
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // The file name is strictly [a-z0-9-].csv, so plain quoting is safe.
      "Content-Disposition": `attachment; filename="${teamReportCsvFileName(range)}"`,
      // Player names are coach data: never cache the export or let it be indexed.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
