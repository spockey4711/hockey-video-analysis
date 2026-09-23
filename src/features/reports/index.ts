/**
 * Public surface of the game report feature (P2-12). The report page and its
 * CSV route import the aggregation, the export and the presentational pieces
 * from here; `queries.ts` is server-only and imported directly by those routes.
 */
export {
  buildGameReport,
  type FigureRow,
  type GameReport,
  type ReportPlayer,
  type ReportTag,
} from "./report";
export {
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
export { ReportSkeleton } from "./ReportSkeleton";
