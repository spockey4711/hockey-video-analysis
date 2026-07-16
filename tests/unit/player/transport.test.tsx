import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  { src: "https://media.test/a.mp4", durationS: 100 },
  { src: "https://media.test/b.mp4", durationS: 150 },
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

  it("cycles the scan speed 1x -> 2x -> 4x -> 1x", () => {
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

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("0:10 / 4:10")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft", shiftKey: true });
    expect(video.pause).toHaveBeenCalled();
    expect(screen.getByText("0:09 / 4:10")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(video.playbackRate).toBe(2);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(video.playbackRate).toBe(1);
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
});
