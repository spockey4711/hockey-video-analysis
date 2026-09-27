import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs against mocked auth and queries: what matters is that no
// end date is stored without a coach session or from a refused day, and that
// save and remove store the right value.
const { getCurrentCoach, setCollectionShareExpiry, revalidatePath } =
  vi.hoisted(() => ({
    getCurrentCoach: vi.fn(),
    setCollectionShareExpiry: vi.fn(),
    revalidatePath: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ getCurrentCoach }));
vi.mock("@/features/access", () => ({ requireCoach: vi.fn() }));
vi.mock("@/features/share/collections/queries", () => ({
  setCollectionShareExpiry,
}));
vi.mock("@/features/share/collections/team-notes", () => ({}));
vi.mock("@/features/share/collections/presenter-notes", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { setShareExpiryAction } from "@/features/share/collections/actions";
import { collectionsContent } from "@/features/share/collections/content";
import {
  shareExpiryInstant,
  zonedDate,
} from "@/features/share/collections/expiry";
import { collectionMutationInitialState } from "@/features/share/collections/state";

const { errors } = collectionsContent.coach;
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };
const COLLECTION_ID = "11111111-1111-4111-8111-111111111111";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  data.set("collectionId", COLLECTION_ID);
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

function run(data: FormData) {
  return setShareExpiryAction(collectionMutationInitialState, data);
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCoach.mockResolvedValue(COACH);
  setCollectionShareExpiry.mockResolvedValue(true);
});

describe("setShareExpiryAction", () => {
  it("stores the midnight after the picked day", async () => {
    const day = "2099-06-30";
    await expect(run(form({ intent: "save", endDate: day }))).resolves.toEqual({
      status: "success",
    });
    expect(setCollectionShareExpiry).toHaveBeenCalledWith(
      COLLECTION_ID,
      shareExpiryInstant(day),
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      `/collections/${COLLECTION_ID}`,
    );
  });

  it("removes the end date with the remove button, whatever the field says", async () => {
    await run(form({ intent: "remove", endDate: "2099-06-30" }));
    expect(setCollectionShareExpiry).toHaveBeenCalledWith(COLLECTION_ID, null);
  });

  it("accepts today", async () => {
    const today = zonedDate(new Date());
    await expect(run(form({ endDate: today }))).resolves.toEqual({
      status: "success",
    });
  });

  it("refuses a past or malformed day without storing it", async () => {
    await expect(run(form({ endDate: "2020-01-01" }))).resolves.toEqual({
      status: "error",
      error: errors.pastEndDate,
    });
    await expect(run(form({ endDate: "2099-02-30" }))).resolves.toEqual({
      status: "error",
      error: errors.invalidEndDate,
    });
    expect(setCollectionShareExpiry).not.toHaveBeenCalled();
  });

  it("stores nothing without a coach session", async () => {
    getCurrentCoach.mockResolvedValue(null);
    await expect(run(form({ endDate: "2099-06-30" }))).resolves.toEqual({
      status: "error",
      error: errors.unauthorized,
    });
    expect(setCollectionShareExpiry).not.toHaveBeenCalled();
  });

  it("reports a collection that is gone", async () => {
    setCollectionShareExpiry.mockResolvedValue(false);
    await expect(run(form({ endDate: "2099-06-30" }))).resolves.toEqual({
      status: "error",
      error: errors.notFound,
    });
  });
});
