/**
 * The SQL side of a tag's types (ADR 0016): a tag counts as a type when it is
 * its main type or one of its further types, so a short corner that ended in a
 * goal is found by a goal filter too. Queries that ask "is this tag a goal"
 * use this condition rather than comparing `tags.type`, which would miss the
 * further types.
 */
import { sql, type SQL } from "drizzle-orm";

import { tags } from "@/lib/db/schema";

/** Whether the tag row counts as the tag type `key`. */
export function tagHasType(key: string): SQL<boolean> {
  return sql<boolean>`(${tags.type} = ${key} or ${key} = any(${tags.extraTypes}))`;
}
