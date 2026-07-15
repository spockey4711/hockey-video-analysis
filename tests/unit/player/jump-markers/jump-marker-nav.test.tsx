import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContinuousPlayer } from "@/features/player";
import type { PlayerSource } from "@/features/player";
import { JumpMarkerNav } from "@/features/player/jump-markers";
import type { JumpMarker } from "@/features/player/jump-markers";

// jsdom does not implement media playback; stub the bits the player reads so a
// seek from the nav updates a real, readable current time.
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// One chapter long enough to hold every marker.
const sources: PlayerSource[] = [
  { src: "https://media.test/a.mp4", durationS: 2000, label: "a.mp4" },
];

const markers: JumpMarker[] = [
  { id: "a", type: "goal", startS: 90 },
  { id: "b", type: "corner_short", startS: 600 },
  { id: "c", type: "action_bad", startS: 1800 },
];

function renderNav(list: readonly JumpMarker[] = markers) {
  return render(
    <ContinuousPlayer
      sources={sources}
      title="HSV"
      aside={<JumpMarkerNav markers={list} />}
    />,
  );
}

describe("JumpMarkerNav", () => {
  it("lists each marker with its type label", () => {
    renderNav();
    expect(screen.getByText("Tor")).toBeInTheDocument();
    expect(screen.getByText("Ecke kurz")).toBeInTheDocument();
    expect(screen.getByText("Aktion schlecht")).toBeInTheDocument();
  });

  it("seeks to a marker's start when its row is clicked", () => {
    renderNav();
    fireEvent.click(screen.getByText("Ecke kurz"));
    expect(currentTime).toBe(600);
  });

  it("jumps to the next marker on the '.' hotkey", () => {
    renderNav();
    currentTime = 100;
    fireEvent.keyDown(window, { key: "." });
    expect(currentTime).toBe(600);
  });

  it("jumps to the previous marker on the ',' hotkey", () => {
    renderNav();
    currentTime = 700;
    fireEvent.keyDown(window, { key: "," });
    expect(currentTime).toBe(600);
  });

  it("does nothing when there is no marker past the playhead", () => {
    renderNav();
    currentTime = 1800;
    fireEvent.keyDown(window, { key: "." });
    expect(currentTime).toBe(1800);
  });

  it("ignores the hotkey while a text field is focused", () => {
    renderNav();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    currentTime = 100;
    fireEvent.keyDown(input, { key: "." });
    expect(currentTime).toBe(100);
    input.remove();
  });

  it("shows an empty state when the game has no markers", () => {
    renderNav([]);
    expect(screen.getByText(/Noch keine Marker/)).toBeInTheDocument();
  });
});
