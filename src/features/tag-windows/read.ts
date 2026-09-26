/**
 * Reading the team's effective tag windows through any drizzle client over this
 * app's schema: the app's (`./queries`) and the clip worker's own, which runs
 * outside Next and so cannot import the server-only app client.
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";
import { tagTypeWindows } from "@/lib/db/schema";
import { resolveTagWindows, type TagWindows } from "@/lib/tag-types";

/** A drizzle client or transaction that can read the windows. */
export type TagWindowsReader = Pick<
  PostgresJsDatabase<typeof schema>,
  "select"
>;

/** The windows the team captures with: its own where set, else the default. */
export async function readTagWindows(
  reader: TagWindowsReader,
): Promise<TagWindows> {
  const rows = await reader
    .select({
      type: tagTypeWindows.type,
      preS: tagTypeWindows.preS,
      postS: tagTypeWindows.postS,
    })
    .from(tagTypeWindows);
  return resolveTagWindows(rows);
}
