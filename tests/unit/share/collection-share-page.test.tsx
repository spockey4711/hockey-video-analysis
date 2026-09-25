import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The collection share page runs against mocked data and auth: what matters is
// that the coach's private presenter notes are read and passed down only for a
// request with a coach session, and never reach a viewer's page otherwise.
const data = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  getCollectionByShareToken: vi.fn(),
  listReadyClipsForCollection: vi.fn(),
  getPresenterNotes: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentCoach: data.getCurrentCoach }));
vi.mock("@/features/clips/comments", async () => ({
  ...(await import("@/features/clips/comments/pinning")),
  listCoachCommentsForClips: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/share/collections", async () => ({
  ...(await import("@/features/share/collections/content")),
  ...(await import("@/features/share/collections/clip-items")),
  getCollectionByShareToken: data.getCollectionByShareToken,
  listReadyClipsForCollection: data.listReadyClipsForCollection,
  getPresenterNotes: data.getPresenterNotes,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import CollectionSharePage from "@/app/share/collection/[token]/page";
import { presentationContent } from "@/features/share/presentation";

const COLLECTION_NOTE = "Thema heute: kurze Ecken";
const CLIP_NOTE = "Auf den Läufer rechts achten";
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };

function clipRow(id: string, startS: number) {
  return {
    id,
    tagType: "ecke_kurz",
    startS,
    outputPath: `clips/${id}.mp4`,
    gameTitle: "Spiel 1",
    gameOpponent: null,
  };
}

async function renderPage() {
  const page = await CollectionSharePage({
    params: Promise.resolve({ token: "share-token" }),
  });
  render(page);
  return page;
}

function openPresentation() {
  fireEvent.click(
    screen.getByRole("button", { name: presentationContent.launch }),
  );
  return screen.getByRole("dialog", { name: presentationContent.regionLabel });
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
  data.getCollectionByShareToken.mockResolvedValue({
    id: "collection-1",
    name: "Standards Woche 3",
  });
  data.listReadyClipsForCollection.mockResolvedValue([
    clipRow("clip-1", 60),
    clipRow("clip-2", 120),
  ]);
  data.getPresenterNotes.mockResolvedValue({
    collection: COLLECTION_NOTE,
    clips: { "clip-1": CLIP_NOTE },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("collection share page presenter notes", () => {
  it("never reads or passes the notes without a coach session", async () => {
    data.getCurrentCoach.mockResolvedValue(null);

    const page = await renderPage();

    expect(data.getPresenterNotes).not.toHaveBeenCalled();
    // The element tree is what the server serializes for the client.
    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain(COLLECTION_NOTE);
    expect(serialized).not.toContain(CLIP_NOTE);

    const dialog = openPresentation();
    fireEvent.keyDown(dialog, { key: "h" });
    expect(
      within(dialog).queryByRole("button", {
        name: presentationContent.notes.toggle,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("complementary", {
        name: presentationContent.notes.panelLabel,
      }),
    ).toBeNull();
    expect(document.body.innerHTML).not.toContain(COLLECTION_NOTE);
    expect(document.body.innerHTML).not.toContain(CLIP_NOTE);
  });

  it("hands a signed-in coach the notes, hidden until switched on", async () => {
    data.getCurrentCoach.mockResolvedValue(COACH);

    await renderPage();

    expect(data.getPresenterNotes).toHaveBeenCalledWith("collection-1");
    const dialog = openPresentation();
    expect(screen.queryByText(CLIP_NOTE)).toBeNull();

    fireEvent.keyDown(dialog, { key: "h" });
    const panel = screen.getByRole("complementary", {
      name: presentationContent.notes.panelLabel,
    });
    expect(within(panel).getByText(COLLECTION_NOTE)).toBeInTheDocument();
    expect(within(panel).getByText(CLIP_NOTE)).toBeInTheDocument();
  });
});
