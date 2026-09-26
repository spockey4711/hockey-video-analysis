import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRef, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FULL_PICTURE, type PlaybackPlan } from "@/features/clip-edits";
import {
  EditedClipStage,
  type EditedClipStageProps,
  type StageControl,
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
  // jsdom has no canvas; the markers overlay then draws nothing.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
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

/** A plan zoomed 2x on the bottom right quarter for the whole clip. */
const zoomed: PlaybackPlan = {
  ...plan,
  zoom: [{ atS: 0, rect: { x: 0.5, y: 0.5, w: 0.5 }, ease: "hold" }],
};

function frame() {
  return screen.getByTestId("picture-frame");
}

function zoomLayer() {
  return screen.getByTestId("picture-zoom");
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

  it("plays on from the in point, whose frame starts just before it", () => {
    render(<Stage />);
    video().currentTime = 0.5;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    expect(video().currentTime).toBe(2);

    // The seek lands on the frame showing the in point, which starts up to a
    // frame earlier. Seeking again would land there again, and never play.
    const seek = vi.spyOn(video(), "currentTime", "set");
    presentFrame(2 - FRAME_S / 2);
    expect(seek).not.toHaveBeenCalled();
    presentFrame(2 + FRAME_S / 2);
    expect(video().paused).toBe(false);
    expect(frameCallbacks).toHaveLength(1);

    // A frame well before the in point still goes back to it.
    presentFrame(1);
    expect(seek).toHaveBeenCalledWith(2);
  });

  it("puts a clip loaded ahead on its own in point as it comes up", () => {
    const items = [
      { id: "a", src: "/a.mp4" },
      { id: "b", src: "/b.mp4" },
    ];
    const { rerender } = render(<Stage items={items} />);
    fireEvent.loadedData(video());
    const loadedAhead = document.querySelectorAll("video")[1];
    Object.defineProperty(loadedAhead, "readyState", {
      value: HTMLMediaElement.HAVE_ENOUGH_DATA,
    });

    rerender(
      <Stage items={items} index={1} plan={{ ...plan, inS: 5, outS: 9 }} />,
    );
    expect(video()).toBe(loadedAhead);
    expect(loadedAhead.currentTime).toBe(5);
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

  it("lays its children over the picture box, clear of the zoom", () => {
    render(
      <Stage plan={zoomed}>
        <p>Clip zu Ende</p>
      </Stage>,
    );
    const child = screen.getByText("Clip zu Ende");
    expect(child.parentElement).toBe(frame().parentElement);
    expect(zoomLayer()).not.toContainElement(child);
  });

  it("lays a picture overlay on the video frame, unzoomed", () => {
    render(<Stage plan={zoomed} pictureOverlay={<p>Rahmen</p>} />);
    const overlay = screen.getByText("Rahmen");
    expect(overlay.parentElement).toBe(frame());
    expect(zoomLayer()).not.toContainElement(overlay);
  });

  it("fits the video frame to the video's shape once it is known", () => {
    render(<Stage />);
    expect(frame().style.getPropertyValue("--picture-aspect")).toBe(
      String(16 / 9),
    );
    Object.defineProperties(video(), {
      videoWidth: { value: 1440 },
      videoHeight: { value: 1080 },
    });
    fireEvent.loadedMetadata(video());
    expect(frame().style.getPropertyValue("--picture-aspect")).toBe(
      String(4 / 3),
    );
  });

  it("plays slow motion at its rate and muted, then full speed with sound", () => {
    render(
      <Stage plan={{ ...plan, slow: [{ startS: 3, endS: 5, rate: 0.25 }] }} />,
    );
    video().currentTime = 2;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    expect(video().playbackRate).toBe(1);

    presentFrame(3.02);
    expect(video().playbackRate).toBe(0.25);
    expect(video().muted).toBe(true);

    presentFrame(5.02);
    expect(video().playbackRate).toBe(1);
    expect(video().muted).toBe(false);
  });

  it("starts in slow motion when played from inside a slow stretch", () => {
    render(
      <Stage plan={{ ...plan, slow: [{ startS: 3, endS: 5, rate: 0.5 }] }} />,
    );
    video().currentTime = 4;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    expect(video().playbackRate).toBe(0.5);
    expect(video().muted).toBe(true);
  });

  it("keeps the viewer's sound off after slow motion", () => {
    render(
      <Stage plan={{ ...plan, slow: [{ startS: 3, endS: 5, rate: 0.5 }] }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: transport.mute }));
    video().currentTime = 2;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    presentFrame(3.02);
    presentFrame(5.02);
    expect(video().muted).toBe(true);
  });

  it("zooms the picture to the plan's crop at the playhead", () => {
    render(
      <Stage
        plan={{
          ...plan,
          zoom: [
            { atS: 3, rect: { x: 0.25, y: 0.1, w: 0.5 }, ease: "hold" },
            { atS: 6, rect: { x: 0, y: 0, w: 1 }, ease: "hold" },
          ],
        }}
      />,
    );
    const scrub = screen.getByRole("slider", { name: stageContent.scrub });
    fireEvent.keyDown(scrub, { key: "Home" });
    expect(zoomLayer().style.transform).toBe("scale(2) translate(-25%, -10%)");

    video().currentTime = 2;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    presentFrame(6.02);
    expect(zoomLayer().style.transform).toBe("");
  });

  it("shows the crop it is given instead of the plan's", () => {
    const { rerender } = render(<Stage plan={zoomed} zoom={FULL_PICTURE} />);
    expect(zoomLayer().style.transform).toBe("");
    rerender(<Stage plan={zoomed} />);
    expect(zoomLayer().style.transform).toBe("scale(2) translate(-50%, -50%)");
  });
});

/** A plan with a marker that holds the picture for two seconds at 4 s. */
const frozen: PlaybackPlan = {
  ...plan,
  marks: [
    {
      id: "m1",
      atS: 4,
      holdS: 2,
      freeze: true,
      strokes: [
        {
          tool: "arrow",
          color: "red",
          width: "medium",
          style: "solid",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.5, y: 0.5 },
          ],
        },
      ],
    },
  ],
};

describe("EditedClipStage markers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Play from `fromS` and present the frames at `frames`. */
  function playThrough(fromS: number, ...frames: number[]) {
    video().currentTime = fromS;
    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    for (const mediaTime of frames) presentFrame(mediaTime);
  }

  it("draws the markers over the picture frame", () => {
    render(<Stage plan={frozen} />);
    expect(frame()).toContainElement(screen.getByTestId("marks-overlay"));
  });

  it("holds the picture on a freezing marker, then plays on by itself", () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    render(<Stage plan={frozen} onPlay={onPlay} onPause={onPause} />);
    playThrough(3, 3.5, 4.02);
    expect(video().paused).toBe(true);
    // The hold is not a stop: the clip still plays for the transport and caller.
    expect(
      screen.getByRole("button", { name: transport.pause }),
    ).toBeInTheDocument();
    expect(onPause).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(video().paused).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(video().paused).toBe(false);
    expect(onPlay).toHaveBeenCalledOnce();
    // Past its marker, the next frame plays on.
    presentFrame(4.06);
    expect(video().paused).toBe(false);
  });

  it("keeps a held picture when paused, and plays on past its marker", () => {
    const onPause = vi.fn();
    render(<Stage plan={frozen} onPause={onPause} />);
    playThrough(3, 4.02);
    fireEvent.click(screen.getByRole("button", { name: transport.pause }));
    expect(onPause).toHaveBeenCalledOnce();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(video().paused).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: transport.play }));
    presentFrame(4.1);
    expect(video().paused).toBe(false);
  });

  it("freezes on a marker right at the frame play starts from", () => {
    render(<Stage plan={frozen} />);
    playThrough(4, 4.02);
    expect(video().paused).toBe(true);
  });

  it("lets a caller's own button pause a hold", () => {
    const control = createRef<StageControl>();
    render(<Stage plan={frozen} controlRef={control} />);
    playThrough(3, 4.02);
    act(() => control.current?.togglePlay());
    expect(
      screen.getByRole("button", { name: transport.play }),
    ).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(video().paused).toBe(true);
  });

  it("ends the clip after the hold of a marker on the out point", () => {
    const onEnded = vi.fn();
    const atOut: PlaybackPlan = {
      ...frozen,
      marks: [{ ...frozen.marks[0], atS: 8 }],
    };
    render(<Stage plan={atOut} onEnded={onEnded} />);
    playThrough(7, 8);
    expect(onEnded).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onEnded).toHaveBeenCalledOnce();
    expect(video().paused).toBe(true);
  });

  it("neither draws nor freezes hidden markers", () => {
    render(<Stage plan={frozen} showMarks={false} />);
    expect(screen.queryByTestId("marks-overlay")).toBeNull();
    playThrough(3, 4.02, 4.5);
    expect(video().paused).toBe(false);
  });

  it("plays on at once when the markers are hidden during a hold", () => {
    const { rerender } = render(<Stage plan={frozen} />);
    playThrough(3, 4.02);
    expect(video().paused).toBe(true);
    rerender(<Stage plan={frozen} showMarks={false} />);
    expect(video().paused).toBe(false);
  });

  it("offers the markers switch in the transport when asked", () => {
    const onToggleMarks = vi.fn();
    const { rerender } = render(
      <Stage plan={frozen} onToggleMarks={onToggleMarks} />,
    );
    const toggle = screen.getByRole("button", { name: transport.marks });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(onToggleMarks).toHaveBeenCalledOnce();
    rerender(
      <Stage plan={frozen} showMarks={false} onToggleMarks={onToggleMarks} />,
    );
    expect(
      screen.getByRole("button", { name: transport.marks }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("offers no markers switch unless asked", () => {
    render(<Stage plan={frozen} />);
    expect(screen.queryByRole("button", { name: transport.marks })).toBeNull();
  });
});
