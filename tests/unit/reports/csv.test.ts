import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/features/reports/csv";

describe("csvCell", () => {
  it("writes plain text and numbers unchanged", () => {
    expect(csvCell("Anna")).toBe("Anna");
    expect(csvCell(12)).toBe("12");
    expect(csvCell(0)).toBe("0");
  });

  it("writes null as an empty cell", () => {
    expect(csvCell(null)).toBe("");
  });

  it("quotes cells holding the delimiter, a quote or a line break", () => {
    expect(csvCell("Heim; Gast")).toBe('"Heim; Gast"');
    expect(csvCell('Der "Zauberer"')).toBe('"Der ""Zauberer"""');
    expect(csvCell("Zeile 1\nZeile 2")).toBe('"Zeile 1\nZeile 2"');
    expect(csvCell("a\rb")).toBe('"a\rb"');
  });

  it("neutralizes text that a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(
      '"\'=HYPERLINK(""http://x"")"',
    );
    expect(csvCell("+49 123")).toBe("'+49 123");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tTab")).toBe("'\tTab");
    expect(csvCell("\r=1")).toBe('"\'\r=1"');
  });

  it("does not guard numbers, which are never text formulas", () => {
    expect(csvCell(-3)).toBe("-3");
  });

  it("rejects non-finite numbers loudly", () => {
    expect(() => csvCell(Number.NaN)).toThrow();
    expect(() => csvCell(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("toCsv", () => {
  it("joins cells with semicolons and rows with CRLF, ending in a line break", () => {
    expect(
      toCsv([
        ["Bereich", "Tor"],
        ["Spiel", 2],
      ]),
    ).toBe("Bereich;Tor\r\nSpiel;2\r\n");
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
