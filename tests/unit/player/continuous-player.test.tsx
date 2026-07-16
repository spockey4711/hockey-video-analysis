import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousPlayer, usePlayerController } from "@/features/player";
import type { PlayerSource } from "@/features/player";

// jsdom does not implement media playback; stub the bits the player touches so
// transport wiring can be exercised without a real <video>.
let currentTime = 0;
beforeEach(() => {
  currentTime = 0;
  Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set: (value: number) => {
      currentTime = value;
    },
  });
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

afterEach(cleanup);

// Two chapters, total 250s (4:10).
const sources: PlayerSource[] = [
  { src: "https://media.test/a.mp4", durationS: 100 },
  { src: "https://media.test/b.mp4", durationS: 150 },
];

function getVideo(container: HTMLElement): HTMLVideoElement {
  const video = container.querySelector("video");
  if (!video) throw new Error("no video rendered");
  return video;
}

describe("ContinuousPlayer", () => {
  it("loads the first chapter and titles the video", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);
    expect(video).toHaveAttribute("src", "https://media.test/a.mp4");
    expect(video).toHaveAttribute("title", "HSV");
  });

  it("scrubs the whole game timeline, not the active chapter", () => {
    render(<ContinuousPlayer sources={sources} title="HSV" />);
    const scrub = screen.getByLabelText("Spielzeit") as HTMLInputElement;
    // Max spans both chapters (250s), so the coach scrubs game time.
    expect(scrub.max).toBe("250");
    expect(screen.getByText("0:00 / 4:10")).toBeInTheDocument();

    fireEvent.change(scrub, { target: { value: "5" } });
    expect(screen.getByText("0:05 / 4:10")).toBeInTheDocument();
  });

  it("toggles play/pause via the transport", () => {
    const { container } = render(
      <ContinuousPlayer sources={sources} title="HSV" />,
    );
    const video = getVideo(container);

    fireEvent.click(screen.getByLabelText("Abspielen"));
    expect(video.play).toHaveBeenCalledOnce();

    // The label follows the element's own play/pause events.
    fireEvent.play(video);
    expect(screen.getByLabelText("Pausieren")).toBeInTheDocument();
  });

  it("renders the typed slots and publishes the controller to slot children", () => {
    function DurationProbe() {
      const { durationS } = usePlayerController();
      return <span>total {durationS}</span>;
    }

    render(
      <ContinuousPlayer
        sources={sources}
        title="HSV"
        aside={<div>tag panel</div>}
        videoOverlay={<div>overlay</div>}
        timelineOverlay={<div>quarter bands</div>}
        tagControls={<DurationProbe />}
      />,
    );

    expect(screen.getByText("tag panel")).toBeInTheDocument();
    expect(screen.getByText("overlay")).toBeInTheDocument();
    expect(screen.getByText("quarter bands")).toBeInTheDocument();
    expect(screen.getByText("total 250")).toBeInTheDocument();
  });
});
