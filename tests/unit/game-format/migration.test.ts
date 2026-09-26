import { readFileSync } from "node:fs";
import path from "node:path";

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { DEFAULT_GAME_FORMAT } from "@/features/game-format/format";
import { games, teamSettings } from "@/lib/db/schema";

const MIGRATION = readFileSync(
  path.join(process.cwd(), "drizzle", "0013_game_format.sql"),
  "utf8",
);

/**
 * The game format migration must leave every existing game on 4 x 15: the
 * game columns arrive empty (so they read the team default) and the team
 * default row starts at the built-in default.
 */
describe("the game format migration", () => {
  it("adds the game's own format as nullable columns without a default", () => {
    expect(MIGRATION).toContain(
      'ALTER TABLE "games" ADD COLUMN "period_count" integer;',
    );
    expect(MIGRATION).toContain(
      'ALTER TABLE "games" ADD COLUMN "period_length_s" integer;',
    );
    const { periodCount, periodLengthS } = getTableColumns(games);
    expect(periodCount.notNull).toBe(false);
    expect(periodCount.hasDefault).toBe(false);
    expect(periodLengthS.notNull).toBe(false);
    expect(periodLengthS.hasDefault).toBe(false);
  });

  it("seeds the one team settings row with the built-in default", () => {
    const { periodCount, periodLengthS } = getTableColumns(teamSettings);
    expect(periodCount.default).toBe(DEFAULT_GAME_FORMAT.periodCount);
    expect(periodLengthS.default).toBe(DEFAULT_GAME_FORMAT.periodLengthS);
    expect(MIGRATION).toContain(
      `"period_count" integer DEFAULT ${DEFAULT_GAME_FORMAT.periodCount} NOT NULL`,
    );
    expect(MIGRATION).toContain(
      `"period_length_s" integer DEFAULT ${DEFAULT_GAME_FORMAT.periodLengthS} NOT NULL`,
    );
    expect(MIGRATION).toMatch(
      /INSERT INTO "team_settings" \("id"\) VALUES \(1\);\s*$/,
    );
  });

  it("keeps team settings to one row and formats inside the rules", () => {
    expect(MIGRATION).toContain(
      'CONSTRAINT "team_settings_singleton" CHECK ("team_settings"."id" = 1)',
    );
    for (const table of ["team_settings", "games"]) {
      expect(MIGRATION).toContain(`"${table}"."period_count" in (2, 4)`);
      expect(MIGRATION).toContain(
        `"${table}"."period_length_s" between 60 and 3600 and "${table}"."period_length_s" % 60 = 0`,
      );
    }
  });
});
