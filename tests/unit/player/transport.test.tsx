import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousPlayer, playerContent } from "@/features/player";
import type { PlayerSource } from "@/features/player";

// jsdom implements no media playback; stub the element bits the transport touches.
let currentTime = 0;
let playbackRate = 1;
beforeEach(() => {
  currentTime = 0;
  playbackRate = 1;
  Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "playbackRate", {
    configurable: true,
    get: () => playbackRate,
    set: (value: number) => {
      playbackRate = value;
    },
  });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

afterEach(cleanup);

// Two chapters, total 250s.
const sources: PlayerSource[] = [
  {
    src: "https://media.test/a.mp4",
    durationS: 100,
    frameRate: null,
    label: "a.mp4",
  },
  {
    src: "https://media.test/b.mp4",
    durationS: 150,
    frameRate: null,
    label: "b.mp4",
  },
];

const { transport, status } = playerContent;

function getVideo(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector("video");
  if (!video) throw new Error("no video rendered");
  return video;
}

describe("transport controls", () => {
  it("steps one second forward off a still frame", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);

    fireEvent.click(screen.getByLabelText(transport.stepForward));
    // A step pauses (so it lands on a frame) and advances one second.
    expect(video.pause).toHaveBeenCalledOnce();
    expect(screen.getByText("0:01 / 4:10")).toBeInTheDocument();
  });

  it("steps a single frame off a still frame", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);

    fireEvent.click(screen.getByLabelText(transport.frameForward));
    fireEvent.click(screen.getByLabelText(transport.frameForward));
    // A frame step pauses like a second-step, and moves a fraction of a second.
    expect(video.pause).toHaveBeenCalledTimes(2);
    expect(video.currentTime).toBeCloseTo(2 / 25, 5);

    fireEvent.click(screen.getByLabelText(transport.frameBack));
    expect(video.currentTime).toBeCloseTo(1 / 25, 5);
  });

  it("steps one frame of the chapter's own frame rate", () => {
    // 50 fps footage (GoPro): a frame step must move 1/50 s, not the 1/25 s the
    // step once assumed for every recording, which skipped a frame per press.
    const fifty: PlayerSource[] = [
      { ...sources[0], frameRate: 50 },
      { ...sources[1], frameRate: 50 },
    ];
    const { container } = render(
      <ContinuousPlayer sources={fifty} title="HSV" />,
    );
    const video = getVideo(container);

    fireEvent.click(screen.getByLabelText(transport.frameForward));
    expect(video.currentTime).toBeCloseTo(1 / 50, 5);
    fireEvent.keyDown(window, { key: "n" });
    expect(video.currentTime).toBeCloseTo(2 / 50, 5);
    fireEvent.keyDown(window, { key: "b" });
    expect(video.currentTime).toBeCloseTo(1 / 50, 5);
    fireEvent.click(screen.getByLabelText(transport.frameBack));
    expect(video.currentTime).toBeCloseTo(0, 5);
  });

  it("does not step back past the opening whistle", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);

    fireEvent.click(screen.getByLabelText(transport.frameBack));
    expect(video.currentTime).toBe(0);
  });

  it("cycles the speed through scan and slow motion", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);

    // The label announces the speed the next click switches to.
    const speed = screen.getByLabelText(transport.speed("2x"));
    expect(speed).toHaveTextContent("1x");

    fireEvent.click(speed);
    expect(screen.getByText("2x")).toBeInTheDocument();
    expect(video.playbackRate).toBe(2);

    fireEvent.click(screen.getByLabelText(transport.speed("4x")));
    expect(screen.getByText("4x")).toBeInTheDocument();
    expect(video.playbackRate).toBe(4);

    // Past top speed the ladder wraps into slow motion.
    fireEvent.click(screen.getByLabelText(transport.speed("0,25x")));
    expect(screen.getByText("0,25x")).toBeInTheDocument();
    expect(video.playbackRate).toBe(0.25);

    fireEvent.click(screen.getByLabelText(transport.speed("0,5x")));
    expect(video.playbackRate).toBe(0.5);

    fireEvent.click(screen.getByLabelText(transport.speed("1x")));
    expect(screen.getByText("1x")).toBeInTheDocument();
    expect(video.playbackRate).toBe(1);
  });

  it("keeps the scan speed across a chapter boundary", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);

    fireEvent.click(screen.getByLabelText(transport.speed("2x")));
    expect(video.playbackRate).toBe(2);

    // Scrub into the second chapter; loading its src resets the element to 1x.
    const scrub = screen.getByLabelText("Spielzeit");
    fireEvent.change(scrub, { target: { value: "200" } });
    playbackRate = 1;
    expect(video).toHaveAttribute("src", "https://media.test/b.mp4");

    // Once the new chapter's metadata is ready, the scan speed is restored.
    fireEvent.loadedMetadata(video);
    expect(video.playbackRate).toBe(2);
  });

  it("drives play, skip, step, and speed from the keyboard", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);

    fireEvent.keyDown(window, { key: " " });
    expect(video.play).toHaveBeenCalledOnce();

    // Arrows hop 5 s, the YouTube short skip.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("0:05 / 4:10")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft", shiftKey: true });
    expect(video.pause).toHaveBeenCalled();
    expect(screen.getByText("0:04 / 4:10")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(video.playbackRate).toBe(2);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(video.playbackRate).toBe(1);
  });

  it("skips 10 s with J and L, whatever the key's case", () => {
    render(<ContinuousPlayer sources={sources} title="HSV" />);

    fireEvent.keyDown(window, { key: "l" });
    expect(screen.getByText("0:10 / 4:10")).toBeInTheDocument();

    // Shift or Caps Lock must not swallow the skip.
    fireEvent.keyDown(window, { key: "L", shiftKey: true });
    expect(screen.getByText("0:20 / 4:10")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByText("0:10 / 4:10")).toBeInTheDocument();
  });

  it("frame-steps and drops into slow motion from the keyboard", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(video.currentTime).toBe(5);

    fireEvent.keyDown(window, { key: "n" });
    expect(video.currentTime).toBeCloseTo(5 + 1 / 25, 5);
    // A capital letter (Caps Lock, stray Shift) drives the same step.
    fireEvent.keyDown(window, { key: "B", shiftKey: true });
    expect(video.currentTime).toBeCloseTo(5, 5);

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(video.playbackRate).toBe(0.5);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(video.playbackRate).toBe(0.25);
    // The slow end clamps rather than wrapping back to top speed.
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(video.playbackRate).toBe(0.25);
  });

  it("ignores transport keys while typing in a field", () => {
    render(
      <ContinuousPlayer
        sources={sources}
        title="HSV"
        tagControls={<input aria-label="note" />}
      />,
    );
    const input = screen.getByLabelText("note");
    fireEvent.keyDown(input, { key: "ArrowRight" });
    // Position is unchanged: the field owns the key, not the transport.
    expect(screen.getByText("0:00 / 4:10")).toBeInTheDocument();
  });

  it("shows a clear paused badge until playback starts", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    expect(screen.getByRole("status", { name: status.paused })).toBeVisible();

    fireEvent.play(getVideo(container));
    expect(screen.queryByRole("status", { name: status.paused })).toBeNull();
  });

  it("plays from the paused badge on the frame, like the transport button", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);
    const badgePlay = () =>
      within(screen.getByRole("status", { name: status.paused })).getByRole(
        "button",
        { name: transport.play },
      );

    // First load: the badge over the frame starts the game.
    fireEvent.click(badgePlay());
    expect(video.play).toHaveBeenCalledOnce();

    // Playing hides the badge; pausing brings it back, and it plays again.
    fireEvent.play(video);
    expect(screen.queryByRole("status", { name: status.paused })).toBeNull();
    fireEvent.pause(video);
    fireEvent.click(badgePlay());
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(video.pause).not.toHaveBeenCalled();
  });
});
