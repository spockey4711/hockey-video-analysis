import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { tagHasType } from "@/features/tagging/type-filter";

// ADR 0016: a tag counts as a type by its main type or a further type, so a
// goal filter finds a short corner that ended in a goal. The condition runs
// on a real database in the E2E check; here it pins which columns it asks.
describe("tagHasType", () => {
  it("matches the main type or any further type", () => {
    const { sql, params } = new PgDialect().sqlToQuery(tagHasType("goal"));
    expect(sql).toBe('("tags"."type" = $1 or $2 = any("tags"."extra_types"))');
    expect(params).toEqual(["goal", "goal"]);
  });
});
