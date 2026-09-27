import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run against mocked auth and queries: nothing is stored without
// a coach session or with an invalid id or outcome.
const {
  getCurrentCoach,
  linkExecutions,
  setExecutionOutcome,
  unlinkExecution,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  linkExecutions: vi.fn(),
  setExecutionOutcome: vi.fn(),
  unlinkExecution: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ getCurrentCoach }));
vi.mock("@/features/tactics/executions/queries", () => ({
  linkExecutions,
  setExecutionOutcome,
  unlinkExecution,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

import {
  executionAction,
  linkExecutionsAction,
} from "@/features/tactics/executions/actions";
import { executionsContent } from "@/features/tactics/executions/content";
import { MAX_LINKS_PER_PICK } from "@/features/tactics/executions/outcome";
import {
  sceneMutationInitialState,
  sceneRedirectInitialState,
} from "@/features/tactics/state";

const { errors } = executionsContent;
const SCENE_ID = "11111111-1111-4111-8111-111111111111";
const TAG_A = "22222222-2222-4222-8222-222222222222";
const TAG_B = "33333333-3333-4333-8333-333333333333";

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCoach.mockResolvedValue({ id: "coach" });
});

describe("linkExecutionsAction", () => {
  const link = (fields: Record<string, string | string[]>) =>
    linkExecutionsAction(sceneRedirectInitialState, form(fields));

  it("links the ticked tags once each and goes back to the scene", async () => {
    linkExecutions.mockResolvedValue(2);
    await expect(
      link({ sceneId: SCENE_ID, tagId: [TAG_A, TAG_B, TAG_A] }),
    ).rejects.toThrow(`redirect:/tactics/${SCENE_ID}`);
    expect(linkExecutions).toHaveBeenCalledWith(SCENE_ID, [TAG_A, TAG_B]);
    expect(revalidatePath).toHaveBeenCalledWith("/tactics");
  });

  it("stores nothing without a session, a valid id or a pick", async () => {
    getCurrentCoach.mockResolvedValueOnce(null);
    expect(await link({ sceneId: SCENE_ID, tagId: TAG_A })).toEqual({
      error: errors.unauthorized,
    });
    expect(await link({ sceneId: SCENE_ID, tagId: [TAG_A, "x"] })).toEqual({
      error: errors.invalidId,
    });
    expect(await link({ sceneId: "nope", tagId: TAG_A })).toEqual({
      error: errors.invalidId,
    });
    expect(await link({ sceneId: SCENE_ID })).toEqual({
      error: executionsContent.picker.noneChosen,
    });
    expect(
      await link({
        sceneId: SCENE_ID,
        tagId: Array.from({ length: MAX_LINKS_PER_PICK + 1 }, () => TAG_A),
      }),
    ).toEqual({ error: errors.tooMany });
    expect(linkExecutions).not.toHaveBeenCalled();
  });

  it("says so when the scene is gone", async () => {
    linkExecutions.mockResolvedValue(null);
    expect(await link({ sceneId: SCENE_ID, tagId: TAG_A })).toEqual({
      error: errors.sceneNotFound,
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("executionAction", () => {
  const act = (fields: Record<string, string>) =>
    executionAction(sceneMutationInitialState, form(fields));

  it("rates an execution", async () => {
    setExecutionOutcome.mockResolvedValue(true);
    expect(
      await act({
        sceneId: SCENE_ID,
        tagId: TAG_A,
        intent: "outcome",
        outcome: "failure",
      }),
    ).toEqual({ status: "success" });
    expect(setExecutionOutcome).toHaveBeenCalledWith(
      SCENE_ID,
      TAG_A,
      "failure",
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/tactics/${SCENE_ID}`);
  });

  it("unlinks an execution, and says so when it was not linked", async () => {
    unlinkExecution.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const fields = { sceneId: SCENE_ID, tagId: TAG_A, intent: "unlink" };
    expect(await act(fields)).toEqual({ status: "success" });
    expect(await act(fields)).toEqual({
      status: "error",
      error: errors.notLinked,
    });
  });

  it("refuses an invalid outcome, id or intent before any query", async () => {
    expect(
      await act({
        sceneId: SCENE_ID,
        tagId: TAG_A,
        intent: "outcome",
        outcome: "won",
      }),
    ).toEqual({ status: "error", error: errors.invalidOutcome });
    expect(
      await act({ sceneId: SCENE_ID, tagId: "x", intent: "unlink" }),
    ).toEqual({ status: "error", error: errors.invalidId });
    expect(
      await act({ sceneId: SCENE_ID, tagId: TAG_A, intent: "drop" }),
    ).toEqual({ status: "error", error: errors.unexpected });
    getCurrentCoach.mockResolvedValueOnce(null);
    expect(
      await act({ sceneId: SCENE_ID, tagId: TAG_A, intent: "unlink" }),
    ).toEqual({ status: "error", error: errors.unauthorized });
    expect(setExecutionOutcome).not.toHaveBeenCalled();
    expect(unlinkExecution).not.toHaveBeenCalled();
  });
});
