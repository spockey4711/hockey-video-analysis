import { describe, expect, it } from "vitest";

import {
  filterPickerClips,
  NO_FILTER,
  toPickerData,
  type PickerClipRow,
  type PickerPlayerRow,
} from "@/features/clip-editor/picker/picker";

const HOME = "11111111-1111-4111-8111-111111111111";
const TEST = "22222222-2222-4222-8222-222222222222";
const ANNA = "a1111111-1111-4111-8111-111111111111";
const BERTA = "a2222222-2222-4222-8222-222222222222";
const CLARA = "a3333333-3333-4333-8333-333333333333";
const NOBODY = "a4444444-4444-4444-8444-444444444444";

function row(overrides: Partial<PickerClipRow> = {}): PickerClipRow {
  return {
    id: "clip-1",
    gameId: HOME,
    gameTitle: "Heimspiel",
    gameOpponent: "TSV Beispiel",
    tagType: "goal",
    startS: 80,
    isSingle: false,
    playerIds: [],
    ...overrides,
  };
}

// In the query's play order: newest game first, then by game time.
const rows: PickerClipRow[] = [
  row({ id: "clip-1", tagType: "action_good", playerIds: [ANNA] }),
  row({ id: "clip-2", startS: 125, tagType: "goal", isSingle: true }),
  row({
    id: "clip-3",
    gameId: TEST,
    gameTitle: "Testspiel",
    gameOpponent: null,
    startS: 10,
    tagType: "custom_type",
    playerIds: [BERTA, ANNA],
  }),
];

const players: PickerPlayerRow[] = [
  { id: CLARA, name: "Clara", jerseyNumber: null },
  { id: BERTA, name: "Berta", jerseyNumber: 11 },
  { id: ANNA, name: "Anna", jerseyNumber: 7 },
  { id: NOBODY, name: "Dora", jerseyNumber: 3 },
];

describe("toPickerData", () => {
  const data = toPickerData(rows, players, new Set(["clip-2"]));

  it("labels each clip as the editor's list does and marks the members", () => {
    expect(data.clips[0]).toEqual({
      id: "clip-1",
      title: "Aktion gut",
      subtitle: "Heimspiel - gegen TSV Beispiel - 1:20",
      gameId: HOME,
      tagType: "action_good",
      playerIds: [ANNA],
      isSingle: false,
      inCollection: false,
    });
    expect(data.clips[1]).toMatchObject({ inCollection: true, isSingle: true });
    // No opponent, no "gegen"; an unknown type keeps its key.
    expect(data.clips[2]).toMatchObject({
      title: "custom_type",
      subtitle: "Testspiel - 0:10",
    });
  });

  it("offers each game once, in the clips' order", () => {
    expect(data.games).toEqual([
      { value: HOME, label: "Heimspiel gegen TSV Beispiel" },
      { value: TEST, label: "Testspiel" },
    ]);
  });

  it("offers the tag types that have a clip, configured ones first", () => {
    expect(data.tagTypes).toEqual([
      { value: "goal", label: "Tor" },
      { value: "action_good", label: "Aktion gut" },
      { value: "custom_type", label: "custom_type" },
    ]);
  });

  it("offers only players linked to a clip, by shirt number then name", () => {
    expect(data.players).toEqual([
      { value: ANNA, label: "7 Anna" },
      { value: BERTA, label: "11 Berta" },
    ]);
    const unnumbered = toPickerData(
      [row({ playerIds: [CLARA, BERTA] })],
      players,
      new Set(),
    );
    expect(unnumbered.players.map((player) => player.label)).toEqual([
      "11 Berta",
      "Clara",
    ]);
  });

  it("is empty with no ready clip", () => {
    expect(toPickerData([], players, new Set())).toEqual({
      clips: [],
      games: [],
      tagTypes: [],
      players: [],
    });
  });
});

describe("filterPickerClips", () => {
  const { clips } = toPickerData(rows, players, new Set());
  const ids = (filter = NO_FILTER) =>
    filterPickerClips(clips, filter).map((clip) => clip.id);

  it("keeps every clip without a filter", () => {
    expect(ids()).toEqual(["clip-1", "clip-2", "clip-3"]);
  });

  it("narrows by game, tag type and player", () => {
    expect(ids({ ...NO_FILTER, gameId: TEST })).toEqual(["clip-3"]);
    expect(ids({ ...NO_FILTER, tagType: "goal" })).toEqual(["clip-2"]);
    expect(ids({ ...NO_FILTER, playerId: ANNA })).toEqual(["clip-1", "clip-3"]);
  });

  it("combines the filters", () => {
    expect(ids({ ...NO_FILTER, gameId: HOME, playerId: ANNA })).toEqual([
      "clip-1",
    ]);
    expect(ids({ gameId: HOME, tagType: "goal", playerId: ANNA })).toEqual([]);
  });
});
