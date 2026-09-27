import { readFileSync } from "node:fs";
import path from "node:path";

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { collections, teamSettings } from "@/lib/db/schema";

const MIGRATION = readFileSync(
  path.join(process.cwd(), "drizzle", "0014_team_share_link.sql"),
  "utf8",
);

/**
 * The team link migration must leave every existing link as it was: the team
 * token starts empty (the env seeds it on first use) and no collection link
 * gets an end date.
 */
describe("the team share link migration", () => {
  it("adds the team token as an empty column, never a value from SQL", () => {
    expect(MIGRATION).toContain(
      'ALTER TABLE "team_settings" ADD COLUMN "team_share_token" text;',
    );
    const { teamShareToken } = getTableColumns(teamSettings);
    expect(teamShareToken.notNull).toBe(false);
    expect(teamShareToken.hasDefault).toBe(false);
  });

  it("gives collection links an optional end date, unset for existing ones", () => {
    expect(MIGRATION).toContain(
      'ALTER TABLE "collections" ADD COLUMN "share_expires_at" timestamp with time zone;',
    );
    const { shareExpiresAt } = getTableColumns(collections);
    expect(shareExpiresAt.notNull).toBe(false);
    expect(shareExpiresAt.hasDefault).toBe(false);
  });
});
