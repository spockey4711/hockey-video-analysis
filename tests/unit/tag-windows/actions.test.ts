import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs against mocked auth and queries: the DB is a boundary, and
// what matters here is that only valid windows reach it, in the right shape.
const queries = vi.hoisted(() => ({
  setTagWindows: vi.fn(),
  resetTagWindows: vi.fn(),
}));
const access = vi.hoisted(() => ({ requireCoach: vi.fn() }));

vi.mock("@/features/access", () => access);
vi.mock("@/features/tag-windows/queries", () => queries);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveTagWindowsAction } from "@/features/tag-windows/actions";
import { tagWindowsContent } from "@/features/tag-windows/content";
import { tagWindowValues } from "@/features/tag-windows/form";
import { DEFAULT_TAG_WINDOWS } from "@/lib/tag-types";

const { problems, errors } = tagWindowsContent;

function form(changes: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values = { ...tagWindowValues(DEFAULT_TAG_WINDOWS), ...changes };
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  access.requireCoach.mockResolvedValue({ id: "coach-1" });
  queries.setTagWindows.mockResolvedValue(undefined);
  queries.resetTagWindows.mockResolvedValue(undefined);
});

describe("saveTagWindowsAction", () => {
  it("stores the team's windows for every type", async () => {
    const state = await saveTagWindowsAction(
      {},
      form({ "goal.preS": "15", "goal.postS": "5" }),
    );
    expect(state).toEqual({ success: "saved" });
    expect(queries.setTagWindows).toHaveBeenCalledWith({
      ...DEFAULT_TAG_WINDOWS,
      goal: { preS: 15, postS: 5 },
    });
  });

  it("marks the bad fields and stores nothing", async () => {
    const state = await saveTagWindowsAction(
      {},
      form({ "goal.preS": "90", "corner_short.postS": "0" }),
    );
    expect(state).toEqual({
      error: problems.summary,
      fieldErrors: {
        "goal.preS": problems.preS,
        "corner_short.postS": problems.postS,
      },
    });
    expect(queries.setTagWindows).not.toHaveBeenCalled();
  });

  it("resets every type to its default and ignores the fields", async () => {
    const state = await saveTagWindowsAction(
      {},
      form({ intent: "reset", "goal.preS": "90" }),
    );
    expect(state).toEqual({ success: "reset" });
    expect(queries.resetTagWindows).toHaveBeenCalledOnce();
    expect(queries.setTagWindows).not.toHaveBeenCalled();
  });

  it("answers with the generic error when the database fails", async () => {
    queries.setTagWindows.mockRejectedValue(new Error("down"));
    expect(await saveTagWindowsAction({}, form())).toEqual({
      error: errors.unexpected,
    });
    queries.resetTagWindows.mockRejectedValue(new Error("down"));
    expect(await saveTagWindowsAction({}, form({ intent: "reset" }))).toEqual({
      error: errors.unexpected,
    });
  });

  it("requires a coach before it reads or writes anything", async () => {
    access.requireCoach.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(saveTagWindowsAction({}, form())).rejects.toThrow();
    expect(queries.setTagWindows).not.toHaveBeenCalled();
    expect(queries.resetTagWindows).not.toHaveBeenCalled();
  });
});
