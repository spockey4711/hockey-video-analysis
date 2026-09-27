import { readFileSync } from "node:fs";
import path from "node:path";

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { tacticsScenes } from "@/lib/db/schema";

const MIGRATION = readFileSync(
  path.join(process.cwd(), "drizzle", "0020_tactics_scene_library.sql"),
  "utf8",
);

/**
 * The set-play library migration adds the category and tags beside the scene
 * document: every existing scene lands in "other" without tags, and nothing
 * else changes.
 */
describe("the tactics scene library migration", () => {
  it("adds the category type and the two columns, touching nothing else", () => {
    expect(MIGRATION).toContain(
      `CREATE TYPE "public"."scene_category" AS ENUM('attack_corner', 'defence_corner', 'free_hit', 'press', 'build_up', 'other');`,
    );
    const statements = MIGRATION.split("--> statement-breakpoint").map((sql) =>
      sql.trim(),
    );
    expect(statements).toHaveLength(3);
    for (const statement of statements.slice(1)) {
      expect(statement).toMatch(/^ALTER TABLE "tactics_scenes" ADD COLUMN /);
    }
  });

  it("files existing scenes as other, without tags", () => {
    expect(MIGRATION).toContain(
      `ADD COLUMN "category" "scene_category" DEFAULT 'other' NOT NULL`,
    );
    expect(MIGRATION).toContain(
      `ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL`,
    );
    const { category, tags } = getTableColumns(tacticsScenes);
    expect(category.notNull).toBe(true);
    expect(tags.notNull).toBe(true);
  });
});
