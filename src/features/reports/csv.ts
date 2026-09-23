/**
 * Minimal CSV writer for the report export (P2-12). Pure and framework-free.
 *
 * The dialect targets the coaches' spreadsheet: German-locale Excel opens a CSV
 * on double-click only when it is semicolon-separated, so cells are joined with
 * `;` (RFC 4180 otherwise: CRLF rows, double-quote quoting with `""` escapes).
 *
 * Every text cell is guarded against CSV/formula injection (OWASP): player names
 * and game titles are coach input, and a cell starting with `=`, `+`, `-`, `@`,
 * a tab or a carriage return would run as a formula when the file is opened. Such
 * cells get a leading `'`, which spreadsheets show as plain text.
 */

/** One cell: text, a count, or `null` for an empty cell. */
export type CsvValue = string | number | null;

const DELIMITER = ";";
const ROW_END = "\r\n";

/** Leading characters a spreadsheet interprets as the start of a formula. */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** Characters that force a cell into double quotes. */
const NEEDS_QUOTES = /[;"\r\n]/;

/**
 * Serialize one cell. Numbers are written as-is (they are data, never a
 * formula); a non-finite number throws, since it signals a bug upstream rather
 * than a value a coach should ever see in the export.
 */
export function csvCell(value: CsvValue): string {
  if (value === null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`cannot write non-finite number ${value} to CSV`);
    }
    return String(value);
  }
  const guarded = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

/** Serialize rows of cells into a CSV document, each row CRLF-terminated. */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map((row) => row.map(csvCell).join(DELIMITER) + ROW_END).join("");
}
