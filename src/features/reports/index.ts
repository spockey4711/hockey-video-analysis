/**
 * Public surface of the report feature (P2-12): the per-game report and the
 * team overview. The report pages and their CSV routes import the aggregation,
 * the export and the presentational pieces from here; `queries.ts` is
 * server-only and imported directly by those routes.
 */
export {
  buildGameReport,
  type FigureRow,
  type GameReport,
  type ReportPlayer,
  type ReportTag,
} from "./report";
export {
  buildTeamReport,
  type GameFigures,
  type TeamReport,
  type TeamReportGame,
  type TeamReportTag,
} from "./team-report";
export {
  isRangeSet,
  parseReportRange,
  reportRangeFacts,
  reportRangeQuery,
  type ReportRange,
} from "./report-range";
export {
  gameBreakdownRows,
  playerBreakdownRows,
  quarterBreakdownRows,
  type BreakdownRow,
} from "./breakdown-rows";
export { reportGameLine, type ReportGameLine } from "./game-line";
export { gameReportCsv, reportCsvFileName } from "./report-csv";
export { reportsContent } from "./content";
export { ReportBreakdownTable } from "./ReportBreakdownTable";
export { ReportFigures } from "./ReportFigures";
export { ReportHeader, type ReportHeaderProps } from "./ReportHeader";
export { ReportRangeForm } from "./ReportRangeForm";
export { ReportSkeleton } from "./ReportSkeleton";
export {
  TeamReportHeader,
  type TeamReportHeaderProps,
} from "./TeamReportHeader";
export { teamReportCsv, teamReportCsvFileName } from "./team-report-csv";
