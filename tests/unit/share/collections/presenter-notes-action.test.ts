import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs against mocked auth and queries: the session lookup and the
// database are boundaries, and what matters here is that nothing is stored
// without a coach session or with an invalid note.
const { getCurrentCoach, savePresenterNotes, revalidatePath } = vi.hoisted(
  () => ({
    getCurrentCoach: vi.fn(),
    savePresenterNotes: vi.fn(),
    revalidatePath: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({ getCurrentCoach }));
vi.mock("@/features/access", () => ({ requireCoach: vi.fn() }));
vi.mock("@/features/share/collections/queries", () => ({}));
vi.mock("@/features/share/collections/presenter-notes", () => ({
  savePresenterNotes,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { savePresenterNotesAction } from "@/features/share/collections/actions";
import { collectionsContent } from "@/features/share/collections/content";
import { collectionMutationInitialState } from "@/features/share/collections/state";
import {
  CLIP_NOTE_FIELD_PREFIX,
  COLLECTION_NOTE_FIELD,
  MAX_PRESENTER_NOTE_LENGTH,
} from "@/features/share/collections/validation";

const { errors } = collectionsContent.coach;
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };
const COLLECTION_ID = "11111111-1111-4111-8111-111111111111";
const CLIP_ID = "22222222-2222-4222-8222-222222222222";

function form(
  collectionNote: string,
  clipNote = "",
  collectionId = COLLECTION_ID,
): FormData {
  const data = new FormData();
  data.set("collectionId", collectionId);
  data.set(COLLECTION_NOTE_FIELD, collectionNote);
  data.set(`${CLIP_NOTE_FIELD_PREFIX}${CLIP_ID}`, clipNote);
  return data;
}

function save(data: FormData) {
  return savePresenterNotesAction(collectionMutationInitialState, data);
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCoach.mockResolvedValue(COACH);
  savePresenterNotes.mockResolvedValue(true);
});

describe("savePresenterNotesAction", () => {
  it("stores the validated notes and refreshes the detail page", async () => {
    const result = await save(form(" Thema: Ecken ", "Läufer beachten"));

    expect(result).toEqual({ status: "success" });
    expect(savePresenterNotes).toHaveBeenCalledWith(COLLECTION_ID, {
      collection: "Thema: Ecken",
      clips: new Map([[CLIP_ID, "Läufer beachten"]]),
    });
    expect(revalidatePath).toHaveBeenCalledWith(
      `/collections/${COLLECTION_ID}`,
    );
  });

  it("stores nothing without a coach session", async () => {
    getCurrentCoach.mockResolvedValue(null);

    const result = await save(form("Thema"));

    expect(result).toEqual({ status: "error", error: errors.unauthorized });
    expect(savePresenterNotes).not.toHaveBeenCalled();
  });

  it("rejects a malformed collection id before any query", async () => {
    const result = await save(form("Thema", "", "not-a-uuid"));

    expect(result).toEqual({ status: "error", error: errors.invalidId });
    expect(savePresenterNotes).not.toHaveBeenCalled();
  });

  it("rejects the whole save when one note is too long", async () => {
    const result = await save(
      form("Thema", "a".repeat(MAX_PRESENTER_NOTE_LENGTH + 1)),
    );

    expect(result).toEqual({ status: "error", error: errors.invalidNote });
    expect(savePresenterNotes).not.toHaveBeenCalled();
  });

  it("reports an unknown collection", async () => {
    savePresenterNotes.mockResolvedValue(false);

    const result = await save(form("Thema"));

    expect(result).toEqual({ status: "error", error: errors.notFound });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a failing store without leaking the cause", async () => {
    savePresenterNotes.mockRejectedValue(new Error("db down"));

    const result = await save(form("Thema"));

    expect(result).toEqual({ status: "error", error: errors.unexpected });
  });
});
