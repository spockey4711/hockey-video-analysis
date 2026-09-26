import { describe, expect, it } from "vitest";

import {
  clipsToRemove,
  toCurationItems,
} from "@/features/share/collections/curation-items";
import type { CurationClipRow } from "@/features/share/collections/queries";

function row(overrides: Partial<CurationClipRow> = {}): CurationClipRow {
  return {
    id: "clip-1",
    tagType: "goal",
    startS: 754, // 12:34
    playedOn: "2026-03-01",
    gameTitle: "HTHC",
    gameOpponent: "UHC",
    isSingle: false,
    ...overrides,
  };
}

describe("toCurationItems", () => {
  it("builds a display-ready checklist item and marks it unchecked when not selected", () => {
    const [item] = toCurationItems([row()], new Set());
    expect(item).toEqual({
      id: "clip-1",
      title: "Tor",
      subtitle: "HTHC - gegen UHC - 12:34",
      isSingle: false,
      checked: false,
      key: { playedOn: "2026-03-01", startS: 754 },
    });
  });

  it("marks an item checked when its id is in the selected set", () => {
    const [item] = toCurationItems([row()], new Set(["clip-1"]));
    expect(item.checked).toBe(true);
  });

  it("omits the opponent from the subtitle when absent", () => {
    const [item] = toCurationItems([row({ gameOpponent: null })], new Set());
    expect(item.subtitle).toBe("HTHC - 12:34");
  });

  it("carries the single flag through for player-specific clips", () => {
    const [item] = toCurationItems([row({ isSingle: true })], new Set());
    expect(item.isSingle).toBe(true);
  });

  it("falls back to the raw type key for an unknown tag type", () => {
    const [item] = toCurationItems([row({ tagType: "mystery" })], new Set());
    expect(item.title).toBe("mystery");
  });

  it("preserves input order", () => {
    const items = toCurationItems(
      [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })],
      new Set(),
    );
    expect(items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});

describe("clipsToRemove", () => {
  it("removes the listed clips the coach left unticked", () => {
    expect(clipsToRemove(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });

  it("never removes a member the checklist did not list, such as a clip being re-cut", () => {
    // "recut" is a member that was not ready when the page rendered, so it was
    // neither listed nor ticked: it must survive the save.
    expect(clipsToRemove(["a", "b"], ["a", "b"])).toEqual([]);
    expect(clipsToRemove(["a"], [])).toEqual(["a"]);
    expect(clipsToRemove([], [])).toEqual([]);
  });

  it("ignores ticked ids that were not listed", () => {
    expect(clipsToRemove(["a"], ["a", "forged"])).toEqual([]);
  });
});
