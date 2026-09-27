import { readFileSync } from "node:fs";
import path from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { sceneExecutions } from "@/lib/db/schema";

const MIGRATION = readFileSync(
  path.join(process.cwd(), "drizzle", "0021_scene_executions.sql"),
  "utf8",
);

/**
 * The plan-vs-reality migration adds one link table between scenes and tags:
 * a tag is linked to a scene at most once, it starts open, and deleting the
 * scene or the tag removes the link.
 */
describe("the scene executions migration", () => {
  it("adds the outcome type and the link table, touching nothing else", () => {
    expect(MIGRATION).toContain(
      `CREATE TYPE "public"."execution_outcome" AS ENUM('success', 'failure', 'open');`,
    );
    expect(MIGRATION).toContain(`CREATE TABLE "scene_executions"`);
    expect(MIGRATION).toContain(
      `"outcome" "execution_outcome" DEFAULT 'open' NOT NULL`,
    );
    expect(MIGRATION).toContain(`PRIMARY KEY("scene_id","tag_id")`);
    expect(MIGRATION).not.toMatch(/ALTER TABLE "(?!scene_executions")/);
    expect(MIGRATION).not.toMatch(/DROP /);
  });

  it("removes a link with its scene or its tag", () => {
    expect(MIGRATION).toMatch(
      /FOREIGN KEY \("scene_id"\) REFERENCES "public"\."tactics_scenes"\("id"\) ON DELETE cascade/,
    );
    expect(MIGRATION).toMatch(
      /FOREIGN KEY \("tag_id"\) REFERENCES "public"\."tags"\("id"\) ON DELETE cascade/,
    );
    const { foreignKeys } = getTableConfig(sceneExecutions);
    expect(foreignKeys.map((key) => key.onDelete)).toEqual([
      "cascade",
      "cascade",
    ]);
  });

  it("indexes the tag side, which the watch page reads by", () => {
    expect(MIGRATION).toContain(
      `CREATE INDEX "scene_executions_tag_idx" ON "scene_executions" USING btree ("tag_id");`,
    );
  });
});
