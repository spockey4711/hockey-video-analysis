import { describe, expect, it } from "vitest";

import { reportGameLine } from "@/features/reports/game-line";

describe("reportGameLine", () => {
  it("shows the title, the opponent and the German date", () => {
    expect(
      reportGameLine({
        title: "Heim vs. Rot-Weiss",
        opponent: "Rot-Weiss",
        playedOn: "2026-05-12",
      }),
    ).toEqual({
      name: "Heim vs. Rot-Weiss",
      meta: ["vs. Rot-Weiss", "12.05.2026"],
    });
  });

  it("labels an unnamed game and drops missing facts", () => {
    expect(
      reportGameLine({ title: " ", opponent: null, playedOn: null }),
    ).toEqual({ name: "Unbenanntes Spiel", meta: [] });
  });
});
