import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlaybackPlan } from "@/features/clip-edits";
import {
  EditedClipStage,
  type EditedClipStageProps,
} from "@/features/clip-edits/stage/EditedClipStage";
import { stageContent } from "@/features/clip-edits/stage/content";
import { FRAME_S } from "@/features/player/useTransportHotkeys";

const plan: PlaybackPlan = {
  inS: 2,
  outS: 8,
  slow: [],
  zoom: [],
  marks: [],
  exact: true,
  trimClamped: false,
};

// jsdom plays nothing: give each element a `paused` flag that play() and
// pause() flip and announce, and hand the per-frame callbacks to the test.
const paused = new WeakMap<HTMLMediaElement, boolean>();
let frameCallbacks: ((now: number, meta: { mediaTime: number }) => void)[] = [];

beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return paused.get(this) ?? true;
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    paused.set(this, false);
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (paused.get(this) === false) {
      paused.set(this, true);
      this.dispatchEvent(new Event("pause"));
    }
  });
  frameCallbacks = [];
  Object.assign(HTMLVideoElement.prototype, {
    requestVideoFrameCallback(
      callback: (now: number, meta: { mediaTime: number }) => void,
    ) {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    },
    cancelVideoFrameCallback() {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLMediaElement.prototype, "paused");
  Reflect.deleteProperty(
    HTMLVideoElement.prototype,
    "requestVideoFrameCallback",
  );
  Reflect.deleteProperty(
    HTMLVideoElement.prototype,
    "cancelVideoFrameCallback",
  );
});

/** Present the next frame, showing `mediaTime`. */
function presentFrame(mediaTime: number) {
  const pending = frameCallbacks;
  frameCallbacks = [];
  act(() => {
    for (const callback of pending) callback(0, { mediaTime });
  });
}

function Stage(props: Partial<EditedClipStageProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  return (
    <EditedClipStage
      items={[{ id: "a", src: "/a.mp4" }]}
      index={0}
      plan={plan}
      videoRef={videoRef}
      title="Tor"
      {...props}
    />
  );
}

function video() {
  const element = document.querySelector("video");
  if (!element) throw new Error("no video element");
  return element;
}

const { transport } = stageContent;

describe("EditedClipStage", () => {
  it("brings its own controls instead of the browser's", () => {
    render(<Stage />);
    expect(video()).not.toHaveAttribute("controls");
    for (const label of [
      transport.play,
      transport.frameBack,
      transport.frameForward,
      transport.mute,
      transport.fullscreenEnter,
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("slider", { name: stageContent.scrub }),
    ).toHaveAttribute("aria-valuetext", "0:00,0 von 0:06,0");
  });

  it("puts a loaded clip on its in point", () => {
    render(<Stage />);
    fireEvent.loadedMetadata(video());
    expect(video().currentTime).toBe(2);
  });

  it("starts at the in point when played from before it", () => {
    render(<Stage />);
    video().currentTime = 0.5;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    expect(video().currentTime).toBe(2);
    expect(screen.getByRole("button", { name: transport.pause })).toBeVisible();
  });

  it("stops at the out point and reports the end once", () => {
    const onEnded = vi.fn();
    render(<Stage onEnded={onEnded} />);
    video().currentTime = 2;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));

    presentFrame(5);
    expect(video().paused).toBe(false);
    presentFrame(8.02);
    expect(video().paused).toBe(true);
    expect(onEnded).toHaveBeenCalledOnce();
    expect(onEnded.mock.calls[0][0].currentTarget).toBe(video());

    // The file's own end, reached later, is the same end.
    fireEvent.ended(video());
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it("starts over at the in point when played from the out point", () => {
    const onEnded = vi.fn();
    render(<Stage onEnded={onEnded} />);
    video().currentTime = 7.99;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    expect(video().currentTime).toBe(2);

    presentFrame(8.05);
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it("scrubs within the in and out point with the keys", () => {
    render(<Stage />);
    fireEvent.loadedMetadata(video());
    const scrub = screen.getByRole("slider", { name: stageContent.scrub });

    fireEvent.keyDown(scrub, { key: "ArrowRight" });
    expect(video().currentTime).toBe(3);
    fireEvent.keyDown(scrub, { key: "End" });
    expect(video().currentTime).toBe(8);
    fireEvent.keyDown(scrub, { key: "ArrowRight", shiftKey: true });
    expect(video().currentTime).toBe(8);
    fireEvent.keyDown(scrub, { key: "Home" });
    expect(video().currentTime).toBe(2);
  });

  it("keeps arrow keys on the scrub bar from reaching the page", () => {
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <Stage />
      </div>,
    );
    fireEvent.keyDown(
      screen.getByRole("slider", { name: stageContent.scrub }),
      {
        key: "ArrowLeft",
      },
    );
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("steps single frames, paused", () => {
    render(<Stage />);
    video().currentTime = 4;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    fireEvent.click(
      screen.getByRole("button", { name: transport.frameForward }),
    );
    expect(video().paused).toBe(true);
    expect(video().currentTime).toBeCloseTo(4 + FRAME_S);
    fireEvent.click(screen.getByRole("button", { name: transport.frameBack }));
    expect(video().currentTime).toBeCloseTo(4);
  });

  it("scrubs over a wider range when given one", () => {
    render(<Stage scrubRange={{ startS: 0, endS: 10 }} />);
    const scrub = screen.getByRole("slider", { name: stageContent.scrub });
    fireEvent.keyDown(scrub, { key: "Home" });
    expect(video().currentTime).toBe(0);
    expect(scrub).toHaveAttribute("aria-valuetext", "0:00,0 von 0:10,0");
  });

  it("switches the sound off and on", () => {
    render(<Stage />);
    fireEvent.click(screen.getByRole("button", { name: transport.mute }));
    expect(video().muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: transport.unmute }));
    expect(video().muted).toBe(false);
  });

  it("fills the window where the browser has no element fullscreen", () => {
    const { container } = render(<Stage />);
    const stage = container.firstElementChild;
    fireEvent.click(
      screen.getByRole("button", { name: transport.fullscreenEnter }),
    );
    expect(stage).toHaveClass("fixed", "inset-0");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(stage).not.toHaveClass("fixed");
  });

  it("asks the browser for fullscreen of the whole stage where it can", () => {
    const request = vi.fn().mockResolvedValue(undefined);
    Object.assign(HTMLElement.prototype, { requestFullscreen: request });
    try {
      const { container } = render(<Stage />);
      fireEvent.click(
        screen.getByRole("button", { name: transport.fullscreenEnter }),
      );
      expect(request).toHaveBeenCalledOnce();
      expect(request.mock.contexts[0]).toBe(container.firstElementChild);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
    }
  });

  it("leaves the fullscreen switch out, or the whole transport, when asked", () => {
    const { rerender } = render(<Stage fullscreen={false} />);
    expect(
      screen.queryByRole("button", { name: transport.fullscreenEnter }),
    ).toBeNull();
    rerender(<Stage hideTransport />);
    expect(screen.queryByRole("button", { name: transport.play })).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("lays its children over the picture", () => {
    render(
      <Stage>
        <p>Clip zu Ende</p>
      </Stage>,
    );
    expect(screen.getByText("Clip zu Ende").parentElement).toBe(
      video().parentElement,
    );
  });
});
