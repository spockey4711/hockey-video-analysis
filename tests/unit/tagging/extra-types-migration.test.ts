import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { tags } from "@/lib/db/schema";

const DRIZZLE = path.join(process.cwd(), "drizzle");
const FILE = readdirSync(DRIZZLE).find((name) =>
  /^\d{4}_tag_extra_types\.sql$/.test(name),
);
const MIGRATION = FILE ? readFileSync(path.join(DRIZZLE, FILE), "utf8") : "";

/**
 * The further types migration (ADR 0016) must be safe on the production data:
 * it only adds a column with a constant default, which rewrites no row and
 * fires no sync trigger, so every stored tag stays a single-type tag at the
 * same version and its clip and share links are untouched.
 */
describe("the tag extra types migration", () => {
  it("adds one column with an empty default and touches no row", () => {
    expect(FILE).toBeDefined();
    expect(MIGRATION).toContain(
      `ALTER TABLE "tags" ADD COLUMN "extra_types" text[] DEFAULT '{}'::text[] NOT NULL`,
    );
    expect(MIGRATION).not.toMatch(/\bUPDATE\b|\bINSERT\b|\bDELETE\b|\bDROP\b/i);
  });

  it("keeps the main type and nulls out of the further types", () => {
    expect(MIGRATION).toContain(
      `CHECK ("tags"."type" <> all("tags"."extra_types") and array_position("tags"."extra_types", null) is null)`,
    );
  });

  it("keeps the main type column the running app and the Mac read", () => {
    const { type, extraTypes } = getTableColumns(tags);
    expect(type.notNull).toBe(true);
    expect(extraTypes.notNull).toBe(true);
    expect(extraTypes.hasDefault).toBe(true);
  });
});
