import { describe, expect, it, vi } from "vitest";

// The share link reads its scene entries through `listSceneEntries`. What
// matters here is that the query never selects the coach's private coaching
// points, so no login-free page can carry them.
vi.mock("@/lib/db", () => ({ db: {} }));

import { listSceneEntries } from "@/features/share/collections/scene-entries";
import { tacticsScenes } from "@/lib/db/schema";

/** A query builder that records what is selected and returns no rows. */
function recordingExecutor() {
  const selected: Record<string, unknown>[] = [];
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => Promise.resolve([]),
  };
  const executor = {
    select: (fields: Record<string, unknown>) => {
      selected.push(fields);
      return chain;
    },
  };
  return { executor, selected };
}

describe("a collection's scene entries on the share link", () => {
  it("never select the scene's coaching points", async () => {
    const { executor, selected } = recordingExecutor();
    await listSceneEntries(
      "11111111-1111-4111-8111-111111111111",
      executor as unknown as Parameters<typeof listSceneEntries>[1],
    );
    expect(selected).toHaveLength(1);
    const columns = Object.values(selected[0] ?? {});
    expect(columns).toContain(tacticsScenes.scene);
    expect(columns).not.toContain(tacticsScenes.coachingNotes);
  });
});
