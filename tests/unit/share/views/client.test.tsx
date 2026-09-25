import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  sendViewEvent,
  viewTracking,
  type ViewTrackingTarget,
} from "@/features/share/views/client";
import {
  VIEW_EVENTS_PATH,
  type ViewEventInput,
} from "@/features/share/views/events";

const clipId = "7f2c1a4e-3b5d-4c6e-8f90-1a2b3c4d5e6f";
const target: ViewTrackingTarget = { shareToken: "tok", clipId };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Render a bare `<video>` with the tracking handlers and a fixed duration. */
function renderVideo(send: Mock<(event: ViewEventInput) => void>) {
  const handlers = viewTracking(target, send);
  const { container } = render(<video {...handlers} />);
  const video = container.querySelector("video")!;
  Object.defineProperty(video, "duration", { value: 10 });
  return video;
}

describe("viewTracking", () => {
  it("returns no handlers when there is nothing to track", () => {
    expect(viewTracking(undefined)).toBeUndefined();
  });

  it("reports the element's events against the link and clip", () => {
    const send = vi.fn<(event: ViewEventInput) => void>();
    const video = renderVideo(send);

    fireEvent.play(video);
    for (let t = 0.25; t <= 9; t += 0.25) {
      video.currentTime = t;
      fireEvent.timeUpdate(video);
    }
    fireEvent.ended(video);
    video.currentTime = 0;
    fireEvent.play(video);

    expect(send.mock.calls.map(([event]) => event)).toEqual([
      { token: "tok", clipId, type: "click" },
      { token: "tok", clipId, type: "full_view" },
      { token: "tok", clipId, type: "replay" },
    ]);
  });

  it("gives every element its own count", () => {
    const send = vi.fn<(event: ViewEventInput) => void>();
    fireEvent.play(renderVideo(send));
    fireEvent.play(renderVideo(send));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.every(([event]) => event.type === "click")).toBe(
      true,
    );
  });
});

describe("viewTracking over an edited clip's window", () => {
  it("counts from the in point and ends at the out point", () => {
    const send = vi.fn<(event: ViewEventInput) => void>();
    // A 30-second file shown from 10 s to 20 s.
    const handlers = viewTracking(
      { ...target, window: { inS: 10, outS: 20 } },
      send,
    );
    const { container } = render(<video {...handlers} />);
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "duration", { value: 30 });

    video.currentTime = 10;
    fireEvent.play(video);
    for (let t = 10.25; t <= 19.5; t += 0.25) {
      video.currentTime = t;
      fireEvent.timeUpdate(video);
    }
    // 9.5 of the window's 10 seconds: a full view, where 9.5 of the file's
    // 30 would not be.
    expect(send.mock.calls.map(([event]) => event.type)).toEqual([
      "click",
      "full_view",
    ]);

    // The player reports the out point as the end; play from the in point
    // after it is a replay.
    video.currentTime = 20;
    handlers?.onEnded({ currentTarget: video });
    video.currentTime = 10;
    fireEvent.play(video);

    expect(send.mock.calls.map(([event]) => event.type)).toEqual([
      "click",
      "full_view",
      "replay",
    ]);
  });

  it("reads a position before the in point as the start", () => {
    const send = vi.fn<(event: ViewEventInput) => void>();
    const handlers = viewTracking(
      { ...target, window: { inS: 10, outS: 20 } },
      send,
    );
    const { container } = render(<video {...handlers} />);
    const video = container.querySelector("video")!;
    video.currentTime = 2;
    fireEvent.play(video);
    // Jumping to the in point adds no played time.
    video.currentTime = 10;
    fireEvent.timeUpdate(video);
    handlers?.onEnded({ currentTarget: video });
    expect(send.mock.calls.map(([event]) => event.type)).toEqual(["click"]);
  });
});

describe("sendViewEvent", () => {
  const event = { token: "tok", clipId, type: "click" } as const;

  it("hands the event to sendBeacon as JSON", async () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    sendViewEvent(event);

    expect(beacon).toHaveBeenCalledOnce();
    const [url, blob] = beacon.mock.calls[0] as [string, Blob];
    expect(url).toBe(VIEW_EVENTS_PATH);
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual(event);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to a keepalive fetch when the beacon is refused", () => {
    vi.stubGlobal("navigator", { sendBeacon: () => false });
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchSpy);

    sendViewEvent(event);

    expect(fetchSpy).toHaveBeenCalledWith(
      VIEW_EVENTS_PATH,
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("swallows every failure", () => {
    vi.stubGlobal("navigator", {
      sendBeacon: () => {
        throw new Error("blocked");
      },
    });
    expect(() => sendViewEvent(event)).not.toThrow();

    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(() => sendViewEvent(event)).not.toThrow();
  });
});
