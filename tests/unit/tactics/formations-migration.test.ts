import { readFileSync } from "node:fs";
import path from "node:path";

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { tacticsFormations } from "@/lib/db/schema";

const MIGRATION = readFileSync(
  path.join(process.cwd(), "drizzle", "0015_tactics_formations.sql"),
  "utf8",
);

/**
 * The formations migration only adds a table: no existing scene or other row
 * changes, and a formation outlives the coach who made it.
 */
describe("the tactics formations migration", () => {
  it("adds the formations table and its kind, touching nothing else", () => {
    expect(MIGRATION).toContain(
      `CREATE TYPE "public"."formation_kind" AS ENUM('attack', 'defence');`,
    );
    expect(MIGRATION).toContain('CREATE TABLE "tactics_formations"');
    const statements = MIGRATION.split("--> statement-breakpoint").map((sql) =>
      sql.trim(),
    );
    for (const statement of statements) {
      expect(statement).toMatch(
        /^(CREATE (TYPE|TABLE)|ALTER TABLE "tactics_formations")/,
      );
    }
  });

  it("keeps a formation when its coach is deleted", () => {
    expect(MIGRATION).toContain(
      'FOREIGN KEY ("created_by") REFERENCES "public"."coaches"("id") ON DELETE set null',
    );
    const { kind, formation, createdBy } = getTableColumns(tacticsFormations);
    expect(kind.notNull).toBe(true);
    expect(formation.notNull).toBe(true);
    expect(createdBy.notNull).toBe(false);
  });
});
