import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The collection share page runs against mocked data and auth: what matters is
// that the coach's private presenter notes are read and passed down only for a
// request with a coach session, and never reach a viewer's page otherwise.
const data = vi.hoisted(() => ({
  getCurrentCoach: vi.fn(),
  getCollectionByShareToken: vi.fn(),
  listReadyClipsForCollection: vi.fn(),
  getPresenterNotes: vi.fn(),
  listScenes: vi.fn(),
  listSceneEntries: vi.fn(),
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
  listSceneEntries: data.listSceneEntries,
}));
vi.mock("@/features/tactics", () => ({ listScenes: data.listScenes }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import CollectionSharePage from "@/app/share/collection/[token]/page";
import { collectionsContent } from "@/features/share/collections/content";
import { playlistContent } from "@/features/share/playlist";
import {
  PresentationMode,
  presentationContent,
} from "@/features/share/presentation";

const COLLECTION_NOTE = "Thema heute: kurze Ecken";
const CLIP_NOTE = "Auf den Läufer rechts achten";
const TEAM_INTRO = "Heute schauen wir auf die kurzen Ecken";
const TEAM_CLIP_NOTE = "Hier stimmt die Absicherung";
const SCENE_NAME = "Konter über links";
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };

function clipRow(id: string, startS: number, teamNote: string | null = null) {
  return {
    id,
    tagType: "corner_short",
    startS,
    playedOn: "2026-03-01",
    outputPath: `clips/${id}.mp4`,
    gameTitle: "Spiel 1",
    gameOpponent: null,
    teamNote,
    timeline: { cutStartS: startS, window: { startS, endS: startS + 12 } },
    edit: null,
  };
}

/** The props the page hands to presentation mode, found in its element tree. */
function presentationProps(node: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = presentationProps(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return undefined;
  if (node.type === PresentationMode) return node.props;
  return presentationProps(node.props.children);
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
    teamNote: TEAM_INTRO,
  });
  data.listReadyClipsForCollection.mockResolvedValue([
    clipRow("clip-1", 60, TEAM_CLIP_NOTE),
    clipRow("clip-2", 120),
  ]);
  data.listSceneEntries.mockResolvedValue([]);
  data.listScenes.mockResolvedValue([
    { id: "scene-1", name: SCENE_NAME, updatedAt: new Date(0) },
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
    expect(presentationProps(page)).not.toHaveProperty("presenterNotes");
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

    const page = await renderPage();

    expect(data.getPresenterNotes).toHaveBeenCalledWith("collection-1");
    expect(presentationProps(page)?.presenterNotes).toEqual({
      collection: COLLECTION_NOTE,
      clips: { "clip-1": CLIP_NOTE },
    });
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

describe("collection share page tactics scenes", () => {
  it("never lists the saved scenes without a coach session", async () => {
    data.getCurrentCoach.mockResolvedValue(null);

    const page = await renderPage();

    expect(data.listScenes).not.toHaveBeenCalled();
    expect(presentationProps(page)).not.toHaveProperty("tacticsScenes");
    expect(JSON.stringify(page)).not.toContain(SCENE_NAME);
  });

  it("hands a signed-in coach the scenes by id and name only", async () => {
    data.getCurrentCoach.mockResolvedValue(COACH);

    const page = await renderPage();

    expect(presentationProps(page)?.tacticsScenes).toEqual([
      { id: "scene-1", name: SCENE_NAME },
    ]);
  });
});

describe("collection share page scene entries", () => {
  it("plays a placed scene between the clips, without its roster links", async () => {
    data.getCurrentCoach.mockResolvedValue(null);
    data.listSceneEntries.mockResolvedValue([
      {
        id: "entry-1",
        sceneId: "scene-1",
        name: SCENE_NAME,
        holdS: 8,
        position: 0,
        after: { playedOn: "2026-03-01", startS: 60 },
        scene: {
          version: 2,
          tokens: [
            {
              id: "p1",
              kind: "player",
              team: "home",
              label: "7",
              playerId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
              x: 30,
              y: 20,
            },
          ],
          lines: [],
          steps: [],
        },
      },
    ]);

    const page = await renderPage();

    const playlist = screen.getByRole("navigation", {
      name: playlistContent.playlist.heading,
    });
    expect(
      within(playlist)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      expect.stringContaining("Ecke kurz"),
      expect.stringContaining(SCENE_NAME),
      expect.stringContaining("Ecke kurz"),
    ]);
    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain("3f2504e0");
    expect(serialized).not.toContain("scene-1");
  });
});

describe("collection share page team notes", () => {
  it("shows a viewer the team notes, and never the presenter notes", async () => {
    data.getCurrentCoach.mockResolvedValue(null);

    const page = await renderPage();

    expect(
      screen.getByRole("region", { name: collectionsContent.share.introLabel }),
    ).toHaveTextContent(TEAM_INTRO);
    // The playlist shows the current clip's text under its title.
    expect(screen.getByText(TEAM_CLIP_NOTE)).toBeInTheDocument();
    expect(presentationProps(page)?.intro).toBe(TEAM_INTRO);
    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain(COLLECTION_NOTE);
    expect(serialized).not.toContain(CLIP_NOTE);

    const dialog = openPresentation();
    const copy = presentationContent.titleCard;
    expect(
      within(dialog).getByRole("group", { name: copy.introLabel }),
    ).toHaveTextContent(TEAM_INTRO);
    fireEvent.click(
      within(dialog).getByRole("button", { name: copy.continue }),
    );
    expect(
      within(dialog).getByRole("group", { name: copy.clipLabel }),
    ).toHaveTextContent(TEAM_CLIP_NOTE);
    expect(document.body.innerHTML).not.toContain(COLLECTION_NOTE);
    expect(document.body.innerHTML).not.toContain(CLIP_NOTE);
  });

  it("looks as before without team notes", async () => {
    data.getCurrentCoach.mockResolvedValue(null);
    data.getCollectionByShareToken.mockResolvedValue({
      id: "collection-1",
      name: "Standards Woche 3",
      teamNote: null,
    });
    data.listReadyClipsForCollection.mockResolvedValue([clipRow("clip-1", 60)]);

    const page = await renderPage();

    expect(
      screen.queryByRole("region", {
        name: collectionsContent.share.introLabel,
      }),
    ).toBeNull();
    expect(presentationProps(page)?.intro).toBeUndefined();
    const dialog = openPresentation();
    expect(
      within(dialog).queryByRole("button", {
        name: presentationContent.titleCard.continue,
      }),
    ).toBeNull();
  });
});
