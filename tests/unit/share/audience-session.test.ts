import { describe, expect, it } from "vitest";

import {
  endMessage,
  pointerMessage,
  sessionMessage,
  stateMessage,
  type AudienceEntry,
  type AudienceState,
} from "@/features/share/presentation/audience-protocol";
import {
  audienceSessionReducer,
  waitingSession,
} from "@/features/share/presentation/audience-session";

const entries: AudienceEntry[] = [
  { kind: "clip", id: "a", src: "/a.mp4", title: "Tor" },
  { kind: "clip", id: "b", src: "/b.mp4", title: "Ecke kurz" },
];

const state: AudienceState = {
  index: 0,
  card: null,
  showMarks: true,
  drawing: null,
  pointer: false,
  board: null,
  media: { playing: false, held: false, time: 0, rate: 1, at: 0 },
};

describe("audienceSessionReducer", () => {
  it("waits until a session comes, ignoring states before it", () => {
    expect(audienceSessionReducer(waitingSession, stateMessage(state))).toBe(
      waitingSession,
    );
    expect(audienceSessionReducer(waitingSession, endMessage)).toBe(
      waitingSession,
    );
    expect(
      audienceSessionReducer(waitingSession, sessionMessage(entries, state)),
    ).toEqual({ kind: "live", entries, state });
  });

  it("follows each state of the session", () => {
    const live = audienceSessionReducer(
      waitingSession,
      sessionMessage(entries, state),
    );
    const next = { ...state, index: 1 };
    expect(audienceSessionReducer(live, stateMessage(next))).toEqual({
      kind: "live",
      entries,
      state: next,
    });
    // One out of range waits for the next session.
    expect(
      audienceSessionReducer(live, stateMessage({ ...state, index: 2 })),
    ).toBe(live);
    expect(audienceSessionReducer(live, pointerMessage(null))).toBe(live);
  });

  it("ends neutrally, and comes back with a new session", () => {
    const live = audienceSessionReducer(
      waitingSession,
      sessionMessage(entries, state),
    );
    const ended = audienceSessionReducer(live, endMessage);
    expect(ended).toEqual({ kind: "ended" });
    expect(audienceSessionReducer(ended, stateMessage(state))).toBe(ended);
    expect(
      audienceSessionReducer(ended, sessionMessage(entries, state)).kind,
    ).toBe("live");
  });

  it("says when the presenter runs another version", () => {
    expect(audienceSessionReducer(waitingSession, "other-version")).toEqual({
      kind: "other-version",
    });
  });
});
