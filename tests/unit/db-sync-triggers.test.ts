import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

// The sync versions and revisions are kept by database triggers (ADR 0013,
// Mac plan S3), which drizzle's schema cannot express. This pins that every
// table carrying a sync column has its trigger in a migration, and that every
// child row an aggregate snapshot shows bumps its parent. How the triggers
// behave is checked against a real database when the migration is written.
const DRIZZLE_DIR = path.join(process.cwd(), "drizzle");
const migrations = readdirSync(DRIZZLE_DIR)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(path.join(DRIZZLE_DIR, name), "utf8"))
  .join("\n");

function hasTrigger(timing: string, table: string, fn: string): boolean {
  const pattern = new RegExp(
    `CREATE TRIGGER "[a-z_]+" ${timing} ON "${table}"\\s+FOR EACH ROW ` +
      `EXECUTE FUNCTION "${fn}"\\(([^)]*)\\)`,
  );
  return pattern.test(migrations);
}

const tables: PgTable[] = [];
for (const value of Object.values(schema) as unknown[]) {
  if (is(value, PgTable)) tables.push(value);
}

function tablesWith(column: string): string[] {
  return tables
    .filter((table) => column in getTableColumns(table))
    .map((table) => getTableName(table));
}

describe("sync triggers", () => {
  it("covers the tables the Mac syncs", () => {
    expect(tablesWith("version").sort()).toEqual([
      "collection_clips",
      "collections",
      "games",
      "players",
      "tactics_scenes",
      "tags",
    ]);
    expect(tablesWith("revision").sort()).toEqual([
      "collections",
      "games",
      "tactics_scenes",
    ]);
  });

  it.each(tablesWith("version"))("bumps %s's row version", (table) => {
    expect(hasTrigger("BEFORE UPDATE", table, "sync_bump_version")).toBe(true);
  });

  it.each(tablesWith("revision"))("bumps %s's revision", (table) => {
    expect(hasTrigger("BEFORE UPDATE", table, "sync_bump_revision")).toBe(true);
  });

  it.each([
    ["game_sources", "sync_bump_parent"],
    ["quarters", "sync_bump_parent"],
    ["tags", "sync_bump_parent"],
    ["tag_players", "sync_bump_parent"],
    ["clips", "sync_bump_clip_game"],
    ["collection_clips", "sync_bump_parent"],
    ["collection_scenes", "sync_bump_parent"],
    ["players", "sync_bump_roster"],
  ])("lets every change to %s reach its aggregate", (table, fn) => {
    expect(hasTrigger("AFTER INSERT OR UPDATE OR DELETE", table, fn)).toBe(
      true,
    );
  });
});
