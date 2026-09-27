import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The password change runs in a transaction; the stand-in records what the
// transaction updates and deletes so the test can read the delete's filter.
const db = vi.hoisted(() => {
  const updateWhere = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where: updateWhere }));
  const deleteWhere = vi.fn<(where: unknown) => Promise<void>>(
    async () => undefined,
  );
  const tx = {
    update: vi.fn(() => ({ set })),
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
  return {
    set,
    deleteWhere,
    tx,
    client: {
      transaction: vi.fn(async (run: (t: typeof tx) => Promise<void>) =>
        run(tx),
      ),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: db.client }));

import { settingsContent } from "@/features/settings/content";
import { replacePasswordAndRevokeSessions } from "@/features/settings/queries";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("replacePasswordAndRevokeSessions", () => {
  it("signs out every session of the coach, the Mac's device sessions included", async () => {
    await replacePasswordAndRevokeSessions("coach-1", "new-hash");

    expect(db.client.transaction).toHaveBeenCalledTimes(1);
    expect(db.set).toHaveBeenCalledWith({ passwordHash: "new-hash" });
    const query = new PgDialect().sqlToQuery(
      db.deleteWhere.mock.calls[0]?.[0] as unknown as SQL,
    );
    // Filtered on the coach alone: no `kind` condition that would spare the Mac.
    expect(query.sql).toBe('"sessions"."coach_id" = $1');
    expect(query.params).toEqual(["coach-1"]);
  });

  it("is what the settings page promises, the Mac app named", () => {
    expect(settingsContent.password.description).toContain("Mac-App");
  });
});
