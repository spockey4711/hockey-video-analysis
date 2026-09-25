import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditInCollection } from "@/features/clip-editor/picker/EditInCollection";
import { pickerContent as copy } from "@/features/clip-editor/picker/content";

const CLIP = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const STANDARDS = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const EDITOR = `/collections/${STANDARDS}/editor?clip=${CLIP}`;

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;
let fetchMock: FetchMock;
let tab: { location: { href: string }; opener: unknown; close: () => void };

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Answer the list and the add with these statuses. */
function serve(addStatus = 201, createStatus = 201) {
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method !== "POST") {
      return respond(200, {
        collections: [{ id: STANDARDS, name: "Standards", clipCount: 2 }],
      });
    }
    return String(url) === "/api/collections"
      ? respond(createStatus, { id: STANDARDS })
      : respond(addStatus, {});
  });
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  tab = { location: { href: "" }, opener: window, close: vi.fn() };
  vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  serve();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderChooser() {
  const onDone = vi.fn();
  render(<EditInCollection clipId={CLIP} onDone={onDone} />);
  const choice = await screen.findByRole("button", { name: /Standards/ });
  return { onDone, choice };
}

describe("EditInCollection", () => {
  it("lists the collections with their clip counts", async () => {
    await renderChooser();
    expect(screen.getByText("2 Clips")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/collections");
  });

  it("adds the clip and opens the editor on it in a new tab", async () => {
    const { onDone, choice } = await renderChooser();
    await act(async () => {
      fireEvent.click(choice);
    });

    // The tab opens on the click itself, so no popup blocker stops it.
    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe(`/api/collections/${STANDARDS}/clips`);
    expect(JSON.parse(String(init?.body))).toEqual({ clipId: CLIP });
    expect(tab.location.href).toBe(EDITOR);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("opens a collection that already holds the clip as it is", async () => {
    serve(409);
    const { onDone, choice } = await renderChooser();
    await act(async () => {
      fireEvent.click(choice);
    });
    expect(tab.location.href).toBe(EDITOR);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("closes the tab and says so when adding failed", async () => {
    serve(500);
    const { onDone, choice } = await renderChooser();
    await act(async () => {
      fireEvent.click(choice);
    });
    expect(tab.close).toHaveBeenCalled();
    expect(screen.getByText(copy.watch.failed)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("offers a link when the browser blocked the tab", async () => {
    vi.mocked(window.open).mockReturnValue(null);
    const { onDone, choice } = await renderChooser();
    await act(async () => {
      fireEvent.click(choice);
    });
    const link = screen.getByRole("link", { name: copy.watch.openEditor });
    expect(link).toHaveAttribute("href", EDITOR);
    expect(link).toHaveAttribute("target", "_blank");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("creates a collection with the clip and opens it", async () => {
    const { onDone } = await renderChooser();
    fireEvent.change(screen.getByLabelText(copy.create.open), {
      target: { value: "Aus dem Tagging" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: copy.create.submitWithClip }),
      );
    });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("/api/collections");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Aus dem Tagging",
      clipId: CLIP,
    });
    expect(tab.location.href).toBe(EDITOR);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("refuses a blank name without opening a tab", async () => {
    await renderChooser();
    fireEvent.change(screen.getByLabelText(copy.create.open), {
      target: { value: "   " },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: copy.create.submitWithClip }),
      );
    });
    expect(window.open).not.toHaveBeenCalled();
    expect(screen.getByText(copy.create.invalidName)).toBeInTheDocument();
  });

  it("closes the tab when the collection could not be created", async () => {
    serve(201, 500);
    const { onDone } = await renderChooser();
    fireEvent.change(screen.getByLabelText(copy.create.open), {
      target: { value: "Ecken" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: copy.create.submitWithClip }),
      );
    });
    expect(tab.close).toHaveBeenCalled();
    // The form says what went wrong, once.
    expect(screen.getAllByText(copy.create.failed)).toHaveLength(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("says when the collections could not be loaded", async () => {
    fetchMock.mockResolvedValue(respond(500, {}));
    render(<EditInCollection clipId={CLIP} onDone={vi.fn()} />);
    expect(await screen.findByText(copy.watch.loadFailed)).toBeInTheDocument();
  });

  it("goes back on cancel", async () => {
    const { onDone } = await renderChooser();
    fireEvent.click(screen.getByRole("button", { name: copy.watch.cancel }));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
