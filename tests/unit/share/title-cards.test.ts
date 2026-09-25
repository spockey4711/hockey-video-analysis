import { describe, expect, it } from "vitest";

import { titleCardsFor } from "@/features/share/presentation/title-cards";

describe("titleCardsFor", () => {
  it("puts the intro and then the first clip's text before the first clip", () => {
    expect(titleCardsFor(0, { teamNote: "Läufer" }, "Heute: Ecken")).toEqual([
      { kind: "intro", text: "Heute: Ecken" },
      { kind: "clip", text: "Läufer" },
    ]);
  });

  it("shows the intro before the first clip only", () => {
    expect(titleCardsFor(1, {}, "Heute: Ecken")).toEqual([]);
    expect(titleCardsFor(2, { teamNote: "Absichern" }, "Heute")).toEqual([
      { kind: "clip", text: "Absichern" },
    ]);
  });

  it("has no card for a clip without a text on a link without an intro", () => {
    expect(titleCardsFor(0, {}, undefined)).toEqual([]);
    expect(titleCardsFor(0, { teamNote: "" }, "")).toEqual([]);
  });
});
