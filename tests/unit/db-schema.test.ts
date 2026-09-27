import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  clipStatusEnum,
  clips,
  coaches,
  comments,
  gameSources,
  games,
  ingestFolderStatusEnum,
  players,
  quarters,
  sessionKindEnum,
  sessions,
  tagPlayers,
  tags,
  tagSourceEnum,
  teamSettings,
  visibilityEnum,
  whistleCandidates,
  whistleStatusEnum,
} from "@/lib/db/schema";

/**
 * The schema is frozen after P0-1: no later task edits `drizzle/`. These tests
 * lock the table set and the stable enum values so accidental drift is caught.
 */
describe("database schema", () => {
  it("defines exactly the expected tables", () => {
    const tables = [
      coaches,
      sessions,
      games,
      gameSources,
      players,
      tags,
      tagPlayers,
      clips,
      comments,
      quarters,
      whistleCandidates,
      teamSettings,
    ];
    const names = tables.map(getTableName).sort();
    expect(names).toEqual(
      [
        "clips",
        "coaches",
        "comments",
        "game_sources",
        "games",
        "players",
        "quarters",
        "sessions",
        "tag_players",
        "tags",
        "team_settings",
        "whistle_candidates",
      ].sort(),
    );
  });

  it("keeps time columns as global game-time offsets (ADR 0002)", () => {
    // All moment-in-game columns are `*_s` seconds offsets, never file-local.
    expect(getTableColumns(tags)).toHaveProperty("startS");
    expect(getTableColumns(tags)).toHaveProperty("endS");
    expect(getTableColumns(quarters)).toHaveProperty("startS");
    expect(getTableColumns(gameSources)).toHaveProperty("durationS");
    expect(getTableColumns(whistleCandidates)).toHaveProperty("atS");
    // Where a clip file really starts, as game time (ADR 0011).
    expect(getTableColumns(clips)).toHaveProperty("cutStartS");
  });

  it("models author fields per the access model", () => {
    // Tags are authored by an authenticated coach; comments by a login-free name.
    expect(getTableColumns(tags)).toHaveProperty("authorId");
    expect(getTableColumns(comments)).toHaveProperty("author");
    expect(getTableColumns(comments)).not.toHaveProperty("authorId");
  });

  it("pins the stable domain enum values", () => {
    expect(visibilityEnum.enumValues).toEqual(["team", "single"]);
    expect(tagSourceEnum.enumValues).toEqual(["manual", "suggestion"]);
    expect(clipStatusEnum.enumValues).toEqual([
      "pending",
      "processing",
      "ready",
      "failed",
    ]);
    expect(whistleStatusEnum.enumValues).toEqual([
      "pending",
      "confirmed",
      "rejected",
    ]);
    expect(ingestFolderStatusEnum.enumValues).toEqual([
      "skipped",
      "imported",
      "rejected",
    ]);
    expect(sessionKindEnum.enumValues).toEqual(["web", "device"]);
  });

  it("gives sessions what the Geräte page and device sign-in need", () => {
    const columns = getTableColumns(sessions);
    expect(columns).toHaveProperty("publicId");
    expect(columns).toHaveProperty("kind");
    expect(columns).toHaveProperty("deviceName");
    expect(columns).toHaveProperty("lastSeenAt");
  });
});
