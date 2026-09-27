import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoardVideoExport } from "@/features/tactics/BoardVideoExport";
import { keyframe } from "@/features/tactics/animation";
import { renderBoardImage } from "@/features/tactics/board-image";
import {
  renderBoardVideo,
  videoEncoderConfig,
  VideoUnsupported,
  type BoardVideoJob,
} from "@/features/tactics/board-video";
import { tacticsContent } from "@/features/tactics/content";
import { SCENE_VERSION, type TacticsScene } from "@/features/tactics/scene";

vi.mock("@/features/tactics/board-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/tactics/board-image")>()),
  renderBoardImage: vi.fn(),
}));

vi.mock("@/features/tactics/board-video", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/tactics/board-video")>()),
  renderBoardVideo: vi.fn(),
  videoEncoderConfig: vi.fn(),
}));

const { video } = tacticsContent;

const SCENE: TacticsScene = {
  version: SCENE_VERSION,
  view: "full",
  tokens: [
    {
      id: "h9",
      kind: "player",
      team: "home",
      label: "9",
      position: "",
      playerId: "roster-1",
      x: 40,
      y: 20,
    },
  ],
  lines: [],
  shapes: [],
  startCaption: "",
  steps: [
    {
      duration: 2,
      hold: 1,
      caption: "Lauf ins Zentrum",
      moves: [{ token: "h9", x: 50, y: 20, via: null }],
    },
  ],
};

const MP4 = new Uint8Array([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]);
const render_ = vi.mocked(renderBoardVideo);
const config = vi.mocked(videoEncoderConfig);
const poster = vi.mocked(renderBoardImage);

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
  config.mockResolvedValue({ codec: "avc1.640028", width: 1280, height: 720 });
  render_.mockResolvedValue(MP4);
  poster.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  downloads = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  URL.createObjectURL = vi.fn((file: Blob) =>
    file.type === "image/png" ? "blob:poster" : "blob:video",
  );
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
  config.mockReset();
  poster.mockReset();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

function openDialog(
  props: Partial<Parameters<typeof BoardVideoExport>[0]> = {},
): void {
  render(
    <BoardVideoExport scene={SCENE} name="Ecke kurz Variante 2" {...props} />,
  );
  fireEvent.click(screen.getByRole("button", { name: video.open }));
}

/** Let the video be made by hand: the job it was given and how to end it. */
function holdRender(): {
  job: () => BoardVideoJob;
  finish: () => void;
} {
  let job: BoardVideoJob | undefined;
  let finish = () => {};
  render_.mockImplementation(
    (given) =>
      new Promise((resolve, reject) => {
        job = given;
        finish = () => resolve(MP4);
        given.signal.addEventListener("abort", () =>
          reject(given.signal.reason),
        );
      }),
  );
  return {
    job: () => {
      if (!job) throw new Error("not started");
      return job;
    },
    finish: () => finish(),
  };
}

describe("BoardVideoExport", () => {
  it("offers no video for a scene without steps", () => {
    render(
      <BoardVideoExport scene={{ ...SCENE, steps: [] }} name="Pressing" />,
    );
    expect(screen.queryByRole("button", { name: video.open })).toBeNull();
  });

  it("says what the video shows and what stays out of it", async () => {
    openDialog();
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    // 1 s lead, 3 s of animation, the 1 s hold topped up to 1.5 s.
    expect(
      screen.getByText(video.shows(1, 4.5), { normalizer: (text) => text }),
    ).toBeInTheDocument();
    expect(screen.getByText(video.privacy)).toBeInTheDocument();
    expect(screen.getByText(video.notes)).toBeInTheDocument();
    // Until the video is made, the preview is its first frame, 1280 wide.
    expect(
      await screen.findByRole("img", { name: video.preview }),
    ).toHaveAttribute("src", "blob:poster");
    expect(poster).toHaveBeenCalledWith(expect.anything(), 1280, 720);
    await waitFor(() => expect(config).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: video.start })).toBeEnabled();
  });

  it("makes the video, shows how far it is, then downloads it", async () => {
    const { job, finish } = holdRender();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: video.start }));
    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1));
    expect(job()).toMatchObject({ scene: SCENE, preset: "wide" });

    act(() => job().onProgress(0.42));
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    expect(screen.getByRole("status").textContent).toBe(video.rendering(42));
    expect(screen.getByRole("button", { name: video.cancel })).toBeEnabled();

    await act(async () => finish());
    const preview = await screen.findByLabelText(video.preview);
    expect(preview.localName).toBe("video");
    expect(preview).toHaveAttribute("src", "blob:video");
    expect(preview).toHaveAttribute("poster", "blob:poster");
    expect(screen.queryByRole("progressbar")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: video.download }));
    await waitFor(() =>
      expect(downloads).toEqual(["ecke-kurz-variante-2-animation.mp4"]),
    );
    await waitFor(() =>
      expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute(
        "open",
      ),
    );
  });

  it("draws each frame it is asked for on the picture's own drawing", async () => {
    const { job } = holdRender();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: video.start }));
    await waitFor(() => expect(render_).toHaveBeenCalled());

    const svg = await act(async () => job().draw(keyframe(SCENE, 1)));
    expect(svg.localName).toBe("svg");
    expect(svg).toHaveTextContent("Lauf ins Zentrum");
    const start = await act(async () => job().draw(keyframe(SCENE, 0)));
    expect(start).not.toHaveTextContent("Lauf ins Zentrum");
  });

  it("cancels the video on its way and can start again", async () => {
    const { job } = holdRender();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: video.start }));
    await waitFor(() => expect(render_).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: video.cancel }));
    expect(job().signal.aborted).toBe(true);
    expect(
      await screen.findByRole("button", { name: video.start }),
    ).toBeEnabled();
    expect(screen.queryByText(video.failed)).toBeNull();
  });

  it("cancels the video when the dialog closes", async () => {
    const { job } = holdRender();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: video.start }));
    await waitFor(() => expect(render_).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: video.close }));
    expect(job().signal.aborted).toBe(true);
  });

  it("says so in German when the browser cannot make videos", async () => {
    config.mockResolvedValue(null);
    openDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      video.unsupported,
    );
    expect(screen.getByRole("button", { name: video.start })).toBeDisabled();
  });

  it("says so when the encoder turns out not to work", async () => {
    render_.mockRejectedValue(new VideoUnsupported());
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: video.start }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      video.unsupported,
    );
  });

  it("says so when the video cannot be made", async () => {
    render_.mockRejectedValue(new Error("broken"));
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: video.start }));
    expect(await screen.findByText(video.failed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: video.start })).toBeEnabled();
  });

  it("makes the shape the coach picks", async () => {
    openDialog();
    fireEvent.click(screen.getByLabelText(tacticsContent.image.presets.square));
    fireEvent.click(screen.getByRole("button", { name: video.start }));
    await waitFor(() =>
      expect(render_).toHaveBeenCalledWith(
        expect.objectContaining({ preset: "square" }),
      ),
    );
  });

  it("hands the video to the share sheet on a phone", async () => {
    coarse = true;
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share, canShare: () => true });
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: video.start }));

    const button = await screen.findByRole("button", { name: video.share });
    expect(
      screen.getByRole("button", { name: video.download }),
    ).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [data] = share.mock.calls[0] as unknown as [ShareData];
    expect(data.files?.map((file) => [file.name, file.type])).toEqual([
      ["ecke-kurz-variante-2-animation.mp4", "video/mp4"],
    ]);
    expect(downloads).toEqual([]);
  });

  it("draws and says the names the board shows", async () => {
    const { job } = holdRender();
    openDialog({ names: new Map([["h9", "Mila"]]) });
    expect(screen.getByText(video.withNames)).toBeInTheDocument();
    expect(screen.queryByText(video.privacy)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: video.start }));
    await waitFor(() => expect(render_).toHaveBeenCalled());
    const svg = await act(async () => job().draw(keyframe(SCENE, 0)));
    expect(svg).toHaveTextContent("Mila");
  });
});
