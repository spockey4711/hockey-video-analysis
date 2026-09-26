import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ClipEditor } from "@/features/clip-editor/ClipEditor";
import { clipEditorContent as copy } from "@/features/clip-editor/content";
import type { EditorEntry } from "@/features/clip-editor/entries";
import { SAVE_DELAY_MS } from "@/features/clip-editor/use-edit-drafts";
import { EMPTY_EDIT } from "@/features/clip-edits";
import { telestrationContent as draw } from "@/features/player/telestration";

const COLLECTION = "c0ffee00-0000-4000-8000-000000000000";

function entry(overrides: Partial<EditorEntry> = {}): EditorEntry {
  return {
    id: "clip-1",
    tagId: "tag-1",
    tagType: "goal",
    title: "Tor",
    subtitle: "Spiel 1 - 1:40",
    isSingle: false,
    status: "ready",
    src: "/clips/clip-1.mp4",
    // The file starts a second before the tag: file time = game time - 99.
    window: { startS: 100, endS: 112 },
    cutStartS: 99,
    gameDurationS: 3600,
    frameRate: 25,
    edit: null,
    version: 0,
    ...overrides,
  };
}

const second = entry({
  id: "clip-2",
  tagId: "tag-2",
  tagType: "corner_short",
  title: "Ecke kurz",
  edit: { ...EMPTY_EDIT, trim: { startS: 101, endS: 110 } },
});

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;
let fetchMock: FetchMock;

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  router.refresh.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Let pending timers run and the promises they start settle. */
async function settle(ms = SAVE_DELAY_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderEditor(entries: EditorEntry[], initialClipId?: string) {
  return render(
    <ClipEditor
      collectionId={COLLECTION}
      collectionName="Standards"
      sharePath="/share/collection/token"
      entries={entries}
      initialClipId={initialClipId}
    />,
  );
}

function handle(name: string) {
  return screen.getByRole("slider", { name });
}

function putCalls() {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
}

describe("ClipEditor", () => {
  it("lists the collection's clips and opens on the one asked for", () => {
    renderEditor([entry(), second], "clip-2");
    const list = screen.getByRole("navigation", { name: copy.list.heading });
    const current = within(list)
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-current") === "true");
    expect(current).toHaveTextContent("Ecke kurz");
    expect(current).toHaveTextContent(copy.list.edited);
    // The stored trim, 101-110 in game time, sits 1 s and 10 s into the clip.
    expect(handle(copy.trim.inHandle)).toHaveAttribute(
      "aria-valuetext",
      "0:01,0",
    );
    expect(handle(copy.trim.outHandle)).toHaveAttribute(
      "aria-valuetext",
      "0:10,0",
    );
  });

  it("shows an empty state for a collection without clips", () => {
    renderEditor([]);
    expect(screen.getByText(copy.empty.title)).toBeInTheDocument();
  });

  it("saves a moved trim point in game time, shortly after the change", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    renderEditor([entry()]);

    fireEvent.keyDown(handle(copy.trim.inHandle), {
      key: "ArrowRight",
      shiftKey: true,
    });
    expect(screen.getByRole("status")).toHaveTextContent(copy.save.pending);
    expect(putCalls()).toHaveLength(0);

    await settle();
    expect(putCalls()).toHaveLength(1);
    const [url, init] = putCalls()[0];
    expect(url).toBe(`/api/collections/${COLLECTION}/clips/clip-1/edit`);
    expect(JSON.parse(init?.body as string)).toEqual({
      version: 0,
      edit: { ...EMPTY_EDIT, trim: { startS: 101, endS: 112 } },
    });
    expect(screen.getByRole("status")).toHaveTextContent(copy.save.saved);

    // The next save names the version the first one returned.
    fireEvent.keyDown(handle(copy.trim.outHandle), {
      key: "ArrowLeft",
      shiftKey: true,
    });
    await settle();
    expect(JSON.parse(putCalls()[1][1]?.body as string).version).toBe(1);
  });

  it("clears the edit when the trim is reset to the whole clip", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    renderEditor([second]);
    fireEvent.click(screen.getByRole("button", { name: copy.trim.reset }));
    await settle();
    expect(JSON.parse(putCalls()[0][1]?.body as string)).toEqual({
      version: 0,
      edit: null,
    });
  });

  it("sets the in and out point at the playhead with I and O", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    renderEditor([entry()]);
    const video = document.querySelector("video")!;

    video.currentTime = 4; // game time 103
    fireEvent.seeked(video);
    fireEvent.keyDown(window, { key: "i" });
    video.currentTime = 9; // game time 108
    fireEvent.seeked(video);
    fireEvent.keyDown(window, { key: "o" });

    await settle();
    expect(JSON.parse(putCalls()[0][1]?.body as string).edit.trim).toEqual({
      startS: 103,
      endS: 108,
    });
  });

  it("stops on a conflict and reloads the entry on request", async () => {
    fetchMock.mockResolvedValueOnce(
      respond(409, { error: "changed", version: 4 }),
    );
    renderEditor([entry()]);
    fireEvent.keyDown(handle(copy.trim.inHandle), {
      key: "ArrowRight",
      shiftKey: true,
    });
    await settle();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(copy.save.conflict);

    // No retry on its own, even after another change.
    fireEvent.keyDown(handle(copy.trim.inHandle), { key: "ArrowRight" });
    await settle();
    expect(putCalls()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(
      respond(200, {
        edit: { ...EMPTY_EDIT, trim: { startS: 105, endS: 112 } },
        version: 4,
      }),
    );
    fireEvent.click(
      within(alert).getByRole("button", { name: copy.save.reload }),
    );
    await settle(0);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/collections/${COLLECTION}/clips/clip-1/edit`,
    );
    expect(screen.getByRole("status")).toHaveTextContent(copy.save.saved);
    expect(handle(copy.trim.inHandle)).toHaveAttribute(
      "aria-valuetext",
      "0:05,0",
    );
  });

  it("lengthens by re-cutting the tag, waits for the cut, then reloads", async () => {
    renderEditor([second]);
    fetchMock.mockResolvedValueOnce(respond(200, { tag: {} }));
    fireEvent.click(screen.getByRole("button", { name: copy.lengthen.before }));
    await settle(0);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/tags/tag-2");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({
      type: "corner_short",
      startS: 98,
      endS: 112,
    });
    expect(screen.getByText(copy.cutting.title)).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();

    // The trim's start moves out with the window, so the new footage plays.
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    await settle();
    const save = putCalls().at(-1);
    expect(JSON.parse(save?.[1]?.body as string).edit.trim).toEqual({
      startS: 98,
      endS: 110,
    });

    // Once the worker is done, the editor reloads the entries.
    fetchMock.mockResolvedValue(respond(200, { clipStatus: "processing" }));
    await settle(2000);
    expect(router.refresh).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(respond(200, { clipStatus: "ready" }));
    await settle(2000);
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("says when lengthening failed", async () => {
    renderEditor([entry()]);
    fetchMock.mockResolvedValueOnce(respond(500, { error: "boom" }));
    fireEvent.click(screen.getByRole("button", { name: copy.lengthen.after }));
    await settle(0);
    expect(screen.getByRole("alert")).toHaveTextContent(copy.lengthen.failed);
    expect(screen.queryByText(copy.cutting.title)).toBeNull();
  });

  it("offers no lengthening past the start of the game", () => {
    renderEditor([entry({ window: { startS: 0, endS: 12 }, cutStartS: 0 })]);
    expect(
      screen.getByRole("button", { name: copy.lengthen.before }),
    ).toBeDisabled();
  });

  it("shows a clip being cut, or failed, instead of the player", () => {
    const { unmount } = renderEditor([entry({ status: "processing" })]);
    expect(screen.getByText(copy.cutting.title)).toBeInTheDocument();
    unmount();
    renderEditor([entry({ status: "failed" })]);
    expect(screen.getByText(copy.failed.title)).toBeInTheDocument();
  });

  it("warns about a clip file whose real start is not measured yet", () => {
    renderEditor([entry({ cutStartS: null })]);
    expect(screen.getByText(copy.trim.inexact)).toBeInTheDocument();
  });

  it("adds slow motion at the playhead and saves its speed", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    renderEditor([entry()]);
    const video = document.querySelector("video")!;
    video.currentTime = 4; // game time 103
    fireEvent.seeked(video);

    fireEvent.click(screen.getByRole("button", { name: copy.slow.add }));
    const block = screen.getByRole("button", {
      name: copy.slow.range("0,5x", "0:03,0", "0:05,0"),
    });
    expect(block).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "0,25x" }));

    await settle();
    expect(JSON.parse(putCalls()[0][1]?.body as string).edit.slow).toEqual([
      { startS: 103, endS: 105, rate: 0.25 },
    ]);
  });

  it("draws slow motion by dragging across the track, even in one frame", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    Object.assign(HTMLElement.prototype, {
      setPointerCapture() {},
      hasPointerCapture: () => true,
    });
    try {
      renderEditor([entry()]);
      const track = within(
        screen.getByRole("region", { name: copy.slow.heading }),
      )
        .getByText(copy.slow.hint)
        .parentElement?.querySelector(".cursor-crosshair");
      if (!(track instanceof HTMLElement)) throw new Error("no slow track");
      // 1200 px over the scrub range, file 1 to 13 (game 100 to 112).
      vi.spyOn(track, "getBoundingClientRect").mockReturnValue(
        DOMRect.fromRect({ x: 0, y: 0, width: 1200, height: 32 }),
      );
      // Release before React re-renders the move: still a drag.
      act(() => {
        fireEvent.pointerDown(track, { pointerId: 1, clientX: 500 });
        fireEvent.pointerMove(track, { pointerId: 1, clientX: 700 });
        fireEvent.pointerUp(track, { pointerId: 1, clientX: 700 });
      });
      await settle();
      expect(JSON.parse(putCalls()[0][1]?.body as string).edit.slow).toEqual([
        { startS: 105, endS: 107, rate: 0.5 },
      ]);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
      Reflect.deleteProperty(HTMLElement.prototype, "hasPointerCapture");
    }
  });

  it("chooses the slow stretch under the playhead instead of adding one", () => {
    renderEditor([
      entry({
        edit: { ...EMPTY_EDIT, slow: [{ startS: 103, endS: 105, rate: 0.5 }] },
      }),
    ]);
    const video = document.querySelector("video")!;
    video.currentTime = 5; // game time 104
    fireEvent.seeked(video);
    fireEvent.click(screen.getByRole("button", { name: copy.slow.add }));
    expect(
      screen.getByRole("button", {
        name: copy.slow.range("0,5x", "0:03,0", "0:05,0"),
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("moves a slow-motion range's end and removes the range", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    renderEditor([
      entry({
        edit: { ...EMPTY_EDIT, slow: [{ startS: 103, endS: 105, rate: 0.5 }] },
      }),
    ]);
    fireEvent.click(
      screen.getByRole("button", {
        name: copy.slow.range("0,5x", "0:03,0", "0:05,0"),
      }),
    );
    fireEvent.keyDown(handle(copy.slow.endHandle), {
      key: "ArrowRight",
      shiftKey: true,
    });
    await settle();
    expect(JSON.parse(putCalls()[0][1]?.body as string).edit.slow).toEqual([
      { startS: 103, endS: 106, rate: 0.5 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: copy.slow.remove }));
    await settle();
    expect(JSON.parse(putCalls()[1][1]?.body as string).edit).toBeNull();
  });

  it("sets a zoom keyframe and drags its crop on the whole picture", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    renderEditor([entry()]);
    const video = document.querySelector("video")!;
    video.currentTime = 4; // game time 103
    fireEvent.seeked(video);

    fireEvent.click(screen.getByRole("button", { name: copy.zoom.add }));
    // The stage shows the whole picture while the crop is set.
    expect(screen.getByTestId("picture-zoom").style.transform).toBe("");
    const frame = screen.getByRole("group", { name: copy.zoom.frame(0.5) });
    fireEvent.keyDown(frame, { key: "ArrowRight" });
    fireEvent.keyDown(frame, { key: "ArrowUp", shiftKey: true });
    // One keyframe has no next one to hold or glide to.
    expect(
      screen.getByRole("button", { name: copy.zoom.eases.hold }),
    ).toBeDisabled();

    await settle();
    expect(JSON.parse(putCalls()[0][1]?.body as string).edit.zoom).toEqual([
      { atS: 103, rect: { x: 0.26, y: 0.2, w: 0.5 }, ease: "glide" },
    ]);

    // Playing shows the zoom as viewers see it.
    fireEvent.play(video);
    expect(screen.queryByRole("group", { name: /Zoom-Ausschnitt/ })).toBeNull();
    expect(screen.getByTestId("picture-zoom").style.transform).toBe(
      "scale(2) translate(-26%, -20%)",
    );
  });

  it("sets how a zoom keyframe reaches the next, and removes one", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    renderEditor([
      entry({
        edit: {
          ...EMPTY_EDIT,
          zoom: [
            { atS: 102, rect: { x: 0, y: 0, w: 1 }, ease: "glide" },
            { atS: 104, rect: { x: 0.25, y: 0.25, w: 0.5 }, ease: "glide" },
          ],
        },
      }),
    ]);
    fireEvent.focus(handle(copy.zoom.key(1)));
    fireEvent.click(screen.getByRole("button", { name: copy.zoom.eases.hold }));
    await settle();
    expect(JSON.parse(putCalls()[0][1]?.body as string).edit.zoom[0].ease).toBe(
      "hold",
    );

    fireEvent.click(screen.getByRole("button", { name: copy.zoom.remove }));
    await settle();
    expect(JSON.parse(putCalls()[1][1]?.body as string).edit.zoom).toEqual([
      { atS: 104, rect: { x: 0.25, y: 0.25, w: 0.5 }, ease: "glide" },
    ]);
  });

  it("draws a marker at the playhead, changes it and deletes it", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value() {},
    });
    renderEditor([entry()]);
    const video = document.querySelector("video")!;
    video.currentTime = 4; // game time 103
    fireEvent.seeked(video);

    const dot = () => {
      const canvas = screen.getByRole("img", { name: draw.canvas });
      fireEvent.pointerDown(canvas, { button: 0, pointerId: 1 });
      fireEvent.pointerUp(canvas, { button: 0, pointerId: 1 });
    };
    const lastEdit = () =>
      JSON.parse(putCalls().at(-1)?.[1]?.body as string).edit;

    fireEvent.click(screen.getByRole("button", { name: copy.marks.add }));
    // Nothing to keep until something is drawn.
    const apply = screen.getByRole("button", { name: copy.marks.apply });
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: draw.tools.freehand }));
    dot();
    // A new marker holds the picture for a few seconds (D6); run it instead.
    fireEvent.click(screen.getByRole("button", { name: copy.marks.modes.run }));
    fireEvent.click(screen.getByRole("button", { name: copy.marks.apply }));
    expect(screen.queryByRole("toolbar", { name: draw.toolbar })).toBeNull();

    await settle();
    const [stored] = lastEdit().marks;
    expect(stored).toMatchObject({ atS: 103, holdS: 3, freeze: false });
    expect(stored.strokes).toHaveLength(1);

    // The applied marker stays chosen: its hold time applies at once.
    fireEvent.click(
      screen.getByRole("button", { name: copy.marks.seconds(5) }),
    );
    await settle();
    expect(lastEdit().marks[0]).toMatchObject({ id: stored.id, holdS: 5 });

    // Drawing it again brings its strokes back to add to.
    fireEvent.click(screen.getByRole("button", { name: copy.marks.edit }));
    dot();
    fireEvent.click(screen.getByRole("button", { name: copy.marks.apply }));
    await settle();
    expect(lastEdit().marks).toHaveLength(1);
    expect(lastEdit().marks[0]).toMatchObject({ id: stored.id, atS: 103 });
    expect(lastEdit().marks[0].strokes).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: copy.marks.remove }));
    await settle();
    expect(lastEdit()).toBeNull();
    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
  });

  it("chooses a marker on its track and drops a drawing on cancel", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    renderEditor([
      entry({
        edit: {
          ...EMPTY_EDIT,
          marks: [
            {
              id: "a",
              atS: 105,
              holdS: 2,
              freeze: true,
              strokes: [
                {
                  tool: "circle",
                  color: "red",
                  width: "medium",
                  style: "solid",
                  points: [
                    { x: 0.2, y: 0.2 },
                    { x: 0.4, y: 0.4 },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: copy.marks.mark("0:05,0", true) }),
    );
    expect(document.querySelector("video")!.currentTime).toBe(6);
    expect(
      screen.getByRole("button", { name: copy.marks.modes.freeze }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: copy.marks.edit }));
    fireEvent.click(screen.getByRole("button", { name: copy.marks.cancel }));
    expect(screen.queryByRole("toolbar", { name: draw.toolbar })).toBeNull();
    await settle();
    expect(putCalls()).toHaveLength(0);
  });

  it("fits an edit into a clip shortened since, so it saves again", async () => {
    fetchMock.mockResolvedValue(respond(200, { version: 1 }));
    renderEditor([
      entry({
        edit: { ...EMPTY_EDIT, slow: [{ startS: 98, endS: 101, rate: 0.5 }] },
      }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: copy.zoom.add }));
    await settle();
    expect(JSON.parse(putCalls()[0][1]?.body as string).edit.slow).toEqual([
      { startS: 100, endS: 101, rate: 0.5 },
    ]);
  });
});
