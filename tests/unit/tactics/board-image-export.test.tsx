import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoardImage } from "@/features/tactics/BoardImage";
import { BoardImageExport } from "@/features/tactics/BoardImageExport";
import { keyframe } from "@/features/tactics/animation";
import { renderBoardImage } from "@/features/tactics/board-image";
import { tacticsContent } from "@/features/tactics/content";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";

vi.mock("@/features/tactics/board-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/tactics/board-image")>()),
  renderBoardImage: vi.fn(),
}));

const { image } = tacticsContent;

const SCENE: TacticsScene = {
  version: SCENE_VERSION,
  view: "full",
  tokens: [
    {
      id: "h9",
      kind: "player",
      team: "home",
      label: "9",
      playerId: "roster-1",
      x: 40,
      y: 20,
    },
    { id: "ball", kind: "ball", x: 45.7, y: 27.5 },
  ],
  lines: [
    {
      id: "l1",
      tool: "arrow",
      color: "yellow",
      width: "medium",
      style: "solid",
      points: [
        { x: 40, y: 20 },
        { x: 60, y: 30 },
      ],
      step: 0,
    },
  ],
  shapes: [],
  steps: [{ duration: 2, moves: [{ token: "h9", x: 50, y: 20, via: null }] }],
};

const PNG = new Blob(["png"], { type: "image/png" });
const render_ = vi.mocked(renderBoardImage);

let downloads: string[];
let coarse: boolean;

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
  render_.mockResolvedValue(PNG);
  downloads = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  URL.createObjectURL = vi.fn(() => "blob:picture");
  URL.revokeObjectURL = vi.fn();
  coarse = false;
  window.matchMedia = vi.fn(
    (query: string) => ({ matches: coarse, media: query }) as MediaQueryList,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  render_.mockReset();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

describe("BoardImage", () => {
  it("draws the moment at the shape's pixel size, labels only", () => {
    const { container } = render(
      <BoardImage
        view="full"
        frame={keyframe(SCENE, 0)}
        preset="standard"
        legend={[]}
        title="Taktiktafel"
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "1920");
    expect(svg).toHaveAttribute("height", "1440");
    expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    expect(
      [...container.querySelectorAll("text")].map((text) => text.textContent),
    ).toEqual(["9"]);
    // One disc per token and no selection ring, trail or hit circle.
    expect(container.querySelectorAll("circle[r='1.2']")).toHaveLength(1);
    expect(container.querySelectorAll("[data-token-id]")).toHaveLength(0);
  });

  it("draws zones under the lines and texts over the tokens", () => {
    const { container } = render(
      <BoardImage
        view="full"
        frame={keyframe(
          {
            ...SCENE,
            shapes: [
              {
                id: "t1",
                kind: "text",
                color: "yellow",
                text: "Druck!",
                bubble: true,
                x: 40,
                y: 15,
                step: 0,
              },
              {
                id: "z1",
                kind: "rect",
                color: "red",
                fill: "hatch",
                points: [
                  { x: 30, y: 10 },
                  { x: 50, y: 30 },
                ],
                step: 0,
              },
            ],
          },
          0,
        )}
        preset="wide"
        legend={[]}
        title="Taktiktafel"
      />,
    );
    const drawn = [...container.querySelectorAll("path, circle, text")];
    const zone = container.querySelector("path[d='M30 10H50V30H30Z'][fill]");
    const hatch = zone?.getAttribute("fill")?.match(/^url\(#(.+)\)$/)?.[1];
    expect(
      hatch && container.querySelector(`pattern[id='${hatch}']`),
    ).toBeTruthy();
    const words = [...container.querySelectorAll("text")].find(
      (text) => text.textContent === "Druck!",
    );
    const disc = container.querySelector("circle[r='1.2']");
    expect(drawn.indexOf(zone as Element)).toBeLessThan(
      drawn.indexOf(disc as Element),
    );
    expect(drawn.indexOf(words as Element)).toBeGreaterThan(
      drawn.indexOf(disc as Element),
    );
  });

  it("leaves out what lies beyond a short-corner quarter", () => {
    const { container } = render(
      <BoardImage
        view="corner"
        frame={keyframe(SCENE, 0)}
        preset="wide"
        legend={[]}
        title="Taktiktafel"
      />,
    );
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });

  it("names the play tools in a legend in the bottom-left corner", () => {
    const { container } = render(
      <BoardImage
        view="full"
        frame={keyframe(SCENE, 0)}
        preset="wide"
        legend={["run", "dribble"]}
        title="Taktiktafel"
      />,
    );
    const names = [...container.querySelectorAll("text")].map(
      (text) => text.textContent,
    );
    expect(names).toEqual([
      "9",
      tacticsContent.board.modes.run,
      tacticsContent.board.modes.dribble,
    ]);
    // Two samples inside the picture, each placed and sized in image pixels.
    const glyphs = container.querySelectorAll("svg svg");
    expect(glyphs).toHaveLength(2);
    for (const glyph of glyphs) {
      expect(Number(glyph.getAttribute("x"))).toBeGreaterThan(0);
      expect(Number(glyph.getAttribute("y"))).toBeGreaterThan(1080 / 2);
      expect(Number(glyph.getAttribute("y"))).toBeLessThan(1080);
      expect(glyph.getAttribute("width")).not.toBeNull();
    }
  });
});

function openDialog(
  state: Parameters<typeof BoardImageExport>[0]["state"] = {
    scene: SCENE,
    step: 0,
    playback: null,
  },
  name = "Ecke kurz Variante 2",
): void {
  render(<BoardImageExport state={state} name={name} />);
  fireEvent.click(screen.getByRole("button", { name: image.open }));
}

describe("BoardImageExport", () => {
  it("puts every play tool of the scene in the legend", async () => {
    const run = {
      ...SCENE.lines[0]!,
      id: "l2",
      tool: "run",
      style: "dotted",
      step: 1,
    } as const;
    openDialog({
      scene: { ...SCENE, lines: [...SCENE.lines, run] },
      step: 0,
      playback: null,
    });
    const picture = screen.getByRole("img", {
      name: image.name,
      hidden: true,
    });
    // The run belongs to step 1 but the legend names it on the start too.
    expect(picture).toHaveTextContent(tacticsContent.board.modes.run);
    await screen.findByRole("button", { name: image.download });
  });

  it("draws the picture and downloads it on a laptop", async () => {
    openDialog();
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(screen.getByText(image.shows.start)).toBeInTheDocument();
    expect(screen.getByText(image.privacy)).toBeInTheDocument();
    expect(render_).toHaveBeenCalledWith(expect.anything(), 1920, 1080);

    const download = await screen.findByRole("button", {
      name: image.download,
    });
    await waitFor(() => expect(download).toBeEnabled());
    expect(screen.getByRole("img", { name: image.preview })).toHaveAttribute(
      "src",
      "blob:picture",
    );
    expect(
      screen.queryByRole("button", { name: image.share }),
    ).not.toBeInTheDocument();

    fireEvent.click(download);
    await waitFor(() =>
      expect(downloads).toEqual(["ecke-kurz-variante-2-start.png"]),
    );
    await waitFor(() =>
      expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute(
        "open",
      ),
    );
  });

  it("draws the shape the coach picks", async () => {
    openDialog();
    fireEvent.click(screen.getByLabelText(image.presets.square));
    await waitFor(() =>
      expect(render_).toHaveBeenLastCalledWith(expect.anything(), 1920, 1920),
    );
  });

  it("hands the file to the share sheet on a phone", async () => {
    coarse = true;
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share, canShare: () => true });
    openDialog({ scene: SCENE, step: 1, playback: null });
    expect(screen.getByText(image.shows.step(1))).toBeInTheDocument();

    const button = await screen.findByRole("button", { name: image.share });
    expect(
      screen.getByRole("button", { name: image.download }),
    ).toBeInTheDocument();
    fireEvent.click(button);

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [data] = share.mock.calls[0] as unknown as [ShareData];
    expect(data.files?.map((file) => [file.name, file.type])).toEqual([
      ["ecke-kurz-variante-2-schritt-1.png", "image/png"],
    ]);
    expect(data).not.toHaveProperty("url");
    expect(downloads).toEqual([]);
  });

  it("stays open when the coach cancels the share sheet", async () => {
    coarse = true;
    Object.assign(navigator, {
      share: vi.fn(async () => {
        throw new DOMException("cancelled", "AbortError");
      }),
      canShare: () => true,
    });
    openDialog();
    fireEvent.click(await screen.findByRole("button", { name: image.share }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(downloads).toEqual([]);
  });

  it("names a moment of a playing animation after its step", async () => {
    openDialog({ scene: SCENE, step: 0, playback: { time: 1, playing: true } });
    expect(screen.getByText(image.shows.moment)).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: image.download }),
    );
    await waitFor(() =>
      expect(downloads).toEqual(["ecke-kurz-variante-2-schritt-1.png"]),
    );
  });

  it("names a board without a scene after the board", async () => {
    openDialog(undefined, "");
    fireEvent.click(
      await screen.findByRole("button", { name: image.download }),
    );
    await waitFor(() => expect(downloads).toEqual(["taktiktafel-start.png"]));
  });

  it("says so when the picture cannot be drawn", async () => {
    render_.mockRejectedValue(new Error("no canvas"));
    openDialog();
    expect(await screen.findByText(image.failed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: image.download })).toBeDisabled();
  });

  it("keeps its key presses from the board underneath", () => {
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <BoardImageExport
          state={{ scene: SCENE, step: 0, playback: null }}
          name="Pressing"
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: image.open }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "z" });
    expect(onKeyDown).not.toHaveBeenCalled();
  });
});
