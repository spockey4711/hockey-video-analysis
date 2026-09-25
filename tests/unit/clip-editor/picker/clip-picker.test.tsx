import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { EditorPickerActions } from "@/features/clip-editor/picker/EditorPickerActions";
import { pickerContent as copy } from "@/features/clip-editor/picker/content";
import type { PickerData } from "@/features/clip-editor/picker/picker";

const COLLECTION = "c0ffee00-0000-4000-8000-000000000000";
const HOME = "11111111-1111-4111-8111-111111111111";
const TEST = "22222222-2222-4222-8222-222222222222";
const ANNA = "a1111111-1111-4111-8111-111111111111";

const picker: PickerData = {
  clips: [
    {
      id: "clip-1",
      title: "Tor",
      subtitle: "Heimspiel - 0:20",
      gameId: HOME,
      tagType: "goal",
      playerIds: [ANNA],
      isSingle: false,
      inCollection: true,
    },
    {
      id: "clip-2",
      title: "Ecke kurz",
      subtitle: "Heimspiel - 0:45",
      gameId: HOME,
      tagType: "corner_short",
      playerIds: [],
      isSingle: true,
      inCollection: false,
    },
    {
      id: "clip-3",
      title: "Aktion gut",
      subtitle: "Testspiel - 1:10",
      gameId: TEST,
      tagType: "action_good",
      playerIds: [ANNA],
      isSingle: false,
      inCollection: false,
    },
  ],
  games: [
    { value: HOME, label: "Heimspiel" },
    { value: TEST, label: "Testspiel" },
  ],
  tagTypes: [
    { value: "goal", label: "Tor" },
    { value: "corner_short", label: "Ecke kurz" },
    { value: "action_good", label: "Aktion gut" },
  ],
  players: [{ value: ANNA, label: "7 Anna" }],
};

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;
let fetchMock: FetchMock;

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  // jsdom has no modal dialogs; open and close them as the browser would.
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  });
  fetchMock = vi.fn<typeof fetch>(async (_url, init) =>
    init?.method === "POST"
      ? respond(201, { clipId: "clip-2" })
      : respond(200, picker),
  );
  vi.stubGlobal("fetch", fetchMock);
  router.refresh.mockReset();
  router.push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openPicker(onAdded = vi.fn()) {
  render(<EditorPickerActions collectionId={COLLECTION} onAdded={onAdded} />);
  fireEvent.click(screen.getByRole("button", { name: copy.picker.open }));
  const dialog = await screen.findByRole("dialog", { name: copy.picker.open });
  await within(dialog).findByText("3 Clips");
  return { dialog, onAdded };
}

function addButton(dialog: HTMLElement, title: string, subtitle: string) {
  return within(dialog).getByRole("button", {
    name: copy.picker.addLabel(title, subtitle),
  });
}

describe("the clip editor's picker", () => {
  it("lists every ready clip, marking members and player-specific clips", async () => {
    const { dialog } = await openPicker();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/collections/${COLLECTION}/clips`,
    );
    // The member is marked instead of offered again.
    expect(within(dialog).getByText(copy.picker.added)).toBeInTheDocument();
    expect(
      within(dialog).getAllByRole("button", { name: /hinzufügen$/ }),
    ).toHaveLength(2);
    expect(within(dialog).getByText(copy.picker.single)).toBeInTheDocument();
  });

  it("narrows the clips by game, tag type and player", async () => {
    const { dialog } = await openPicker();
    fireEvent.change(within(dialog).getByLabelText(copy.picker.player), {
      target: { value: ANNA },
    });
    expect(within(dialog).getByText("2 Clips")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(copy.picker.game), {
      target: { value: TEST },
    });
    expect(within(dialog).getByText("1 Clip")).toBeInTheDocument();
    expect(within(dialog).getByText("Testspiel - 1:10")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(copy.picker.tagType), {
      target: { value: "goal" },
    });
    expect(within(dialog).getByText(copy.picker.noMatch)).toBeInTheDocument();
  });

  it("adds a clip, then selects it once the entries reload", async () => {
    const { dialog, onAdded } = await openPicker();
    await act(async () => {
      fireEvent.click(addButton(dialog, "Ecke kurz", "Heimspiel - 0:45"));
    });

    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe(`/api/collections/${COLLECTION}/clips`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ clipId: "clip-2" });
    expect(onAdded).toHaveBeenCalledWith("clip-2");
    expect(router.refresh).toHaveBeenCalledOnce();
    // The picker stays open for the next clip, with this one marked.
    expect(within(dialog).getAllByText(copy.picker.added)).toHaveLength(2);
  });

  it("marks a clip someone else already added without selecting it", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? respond(409, { error: "duplicate" })
        : respond(200, picker),
    );
    const { dialog, onAdded } = await openPicker();
    await act(async () => {
      fireEvent.click(addButton(dialog, "Ecke kurz", "Heimspiel - 0:45"));
    });
    expect(within(dialog).getAllByText(copy.picker.added)).toHaveLength(2);
    expect(onAdded).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("says when adding failed and leaves the clip on offer", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? respond(500, { error: "boom" })
        : respond(200, picker),
    );
    const { dialog, onAdded } = await openPicker();
    await act(async () => {
      fireEvent.click(addButton(dialog, "Ecke kurz", "Heimspiel - 0:45"));
    });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      copy.picker.addFailed,
    );
    expect(addButton(dialog, "Ecke kurz", "Heimspiel - 0:45")).toBeEnabled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("offers a retry when the clips could not be loaded", async () => {
    fetchMock.mockResolvedValueOnce(respond(500, {}));
    render(<EditorPickerActions collectionId={COLLECTION} onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: copy.picker.open }));
    fireEvent.click(
      await screen.findByRole("button", { name: copy.picker.retry }),
    );
    expect(await screen.findByText("3 Clips")).toBeInTheDocument();
  });

  it("says so when no clip is ready yet", async () => {
    fetchMock.mockResolvedValue(
      respond(200, { clips: [], games: [], tagTypes: [], players: [] }),
    );
    render(<EditorPickerActions collectionId={COLLECTION} onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: copy.picker.open }));
    expect(await screen.findByText(copy.picker.none)).toBeInTheDocument();
  });

  it("closes on its close button", async () => {
    const { dialog } = await openPicker();
    fireEvent.click(
      within(dialog).getByRole("button", { name: copy.picker.close }),
    );
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
    expect(screen.queryByText("3 Clips")).not.toBeInTheDocument();
  });
});

describe("the clip editor's new collection", () => {
  function openCreate() {
    render(<EditorPickerActions collectionId={COLLECTION} onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: copy.create.open }));
    return screen.getByRole("dialog", { name: copy.create.open });
  }

  it("creates an empty collection and opens it in this editor", async () => {
    fetchMock.mockResolvedValue(respond(201, { id: "new-id" }));
    const dialog = openCreate();
    const name = within(dialog).getByLabelText(copy.create.label);
    // The dialog starts in the name field.
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "Ecken" } });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: copy.create.submit }),
      );
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/collections");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Ecken" });
    expect(router.push).toHaveBeenCalledWith("/collections/new-id/editor");
  });

  it("shows a name the server refused", async () => {
    fetchMock.mockResolvedValue(respond(400, { error: "name" }));
    const dialog = openCreate();
    fireEvent.change(within(dialog).getByLabelText(copy.create.label), {
      target: { value: "Ecken" },
    });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: copy.create.submit }),
      );
    });
    expect(
      within(dialog).getByText(copy.create.invalidName),
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
