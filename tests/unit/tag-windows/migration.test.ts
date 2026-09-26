import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { tagTypeWindows } from "@/lib/db/schema";
import { MAX_POST_S, MAX_PRE_S, MIN_POST_S, MIN_PRE_S } from "@/lib/tag-types";

const DRIZZLE = path.join(process.cwd(), "drizzle");
const FILE = readdirSync(DRIZZLE).find((name) =>
  /^\d{4}_tag_type_windows\.sql$/.test(name),
);
const MIGRATION = FILE ? readFileSync(path.join(DRIZZLE, FILE), "utf8") : "";

/**
 * The tag windows migration only adds an empty table: every type keeps its
 * default until the coach sets a window, and no existing tag is touched,
 * because a tag stores its own start and end.
 */
describe("the tag windows migration", () => {
  it("adds one table and seeds no rows", () => {
    expect(FILE).toBeDefined();
    expect(MIGRATION).toContain('CREATE TABLE "tag_type_windows"');
    expect(MIGRATION).not.toMatch(/INSERT INTO/);
    expect(MIGRATION).not.toMatch(/"tags"/);
  });

  it("keys a window by its tag type and requires both edges", () => {
    const { type, preS, postS } = getTableColumns(tagTypeWindows);
    expect(type.primary).toBe(true);
    expect(preS.notNull).toBe(true);
    expect(postS.notNull).toBe(true);
  });

  it("checks the same bounds the settings form does", () => {
    expect(MIGRATION).toContain(
      `"tag_type_windows"."pre_s" between ${MIN_PRE_S} and ${MAX_PRE_S}`,
    );
    expect(MIGRATION).toContain(
      `"tag_type_windows"."post_s" between ${MIN_POST_S} and ${MAX_POST_S}`,
    );
  });
});
