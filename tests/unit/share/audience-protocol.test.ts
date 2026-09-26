import { describe, expect, it } from "vitest";

import type { PlaybackPlan } from "@/features/clip-edits/playback";
import type { PlaylistEntry } from "@/features/share/playlist/types";
import {
  AUDIENCE_PROTOCOL_VERSION,
  audienceBoard,
  audienceChannelName,
  audienceEntries,
  audienceUrl,
  byeMessage,
  commandMessage,
  endMessage,
  helloMessage,
  parseAudienceMessage,
  parsePresenterMessage,
  pointerMessage,
  sessionIdFromHash,
  sessionMessage,
  stateMessage,
  type AudienceState,
} from "@/features/share/presentation/audience-protocol";
import { defaultScene, type TacticsScene } from "@/features/tactics/scene";

const plan: PlaybackPlan = {
  inS: 1,
  outS: 6,
  slow: [],
  zoom: [],
  marks: [],
  exact: true,
  trimClamped: false,
};

/** A scene whose first player links to a roster player. */
function linkedScene(): TacticsScene {
  const scene = defaultScene();
  return {
    ...scene,
    tokens: scene.tokens.map((token, index) =>
      index === 0 && token.kind === "player"
        ? { ...token, playerId: "roster-7" }
        : token,
    ),
  };
}

const items: PlaylistEntry[] = [
  {
    id: "a",
    src: "/a.mp4",
    title: "Tor",
    subtitle: "Spiel 1 - 1:00",
    coachComment: "Früher abspielen.",
    teamNote: "Achtet auf die Läufer.",
    plan,
    frameRate: 25,
  },
  {
    kind: "scene",
    id: "s1",
    title: "Ecke Variante 1",
    subtitle: "Taktikszene - Standbild, 8 s",
    scene: linkedScene(),
    holdS: 8,
  },
  { id: "b", src: "/b.mp4", title: "Ecke kurz" },
];

const state: AudienceState = {
  index: 0,
  card: { kind: "clip", text: "Achtet auf die Läufer." },
  showMarks: true,
  drawing: [
    {
      tool: "arrow",
      color: "red",
      width: "medium",
      style: "solid",
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.6 },
      ],
    },
  ],
  pointer: true,
  board: null,
  media: { playing: true, held: false, time: 2.5, rate: 1, at: 1000 },
};

/** A message as it arrives: structured-cloned, as a channel delivers it. */
function delivered<T>(message: T): unknown {
  return structuredClone(message);
}

describe("audience addressing", () => {
  it("names the channel and the window's address after the session", () => {
    expect(audienceChannelName("abc12345")).toBe("hva-presentation:abc12345");
    expect(audienceUrl("abc12345")).toBe("/share/present#abc12345");
  });

  it("reads the session id from the fragment, and only a plausible one", () => {
    expect(sessionIdFromHash("#0123456789abcdef")).toBe("0123456789abcdef");
    expect(sessionIdFromHash("0123456789abcdef")).toBe("0123456789abcdef");
    expect(sessionIdFromHash("")).toBeNull();
    expect(sessionIdFromHash("#short")).toBeNull();
    expect(sessionIdFromHash("#<script>alert(1)</script>")).toBeNull();
  });
});

describe("audienceEntries", () => {
  it("copies only what the audience draws", () => {
    const [clip, scene, plain] = audienceEntries(items);
    expect(clip).toEqual({
      kind: "clip",
      id: "a",
      src: "/a.mp4",
      title: "Tor",
      plan,
      frameRate: 25,
    });
    expect(plain).toEqual({
      kind: "clip",
      id: "b",
      src: "/b.mp4",
      title: "Ecke kurz",
    });
    expect(scene).toMatchObject({ kind: "scene", id: "s1", holdS: 8 });
    expect(JSON.stringify([clip, scene, plain])).not.toMatch(
      /Früher|Läufer|Spiel 1|Standbild|roster-7/,
    );
  });

  it("leaves a field added to the presenter's entries on the laptop", () => {
    const withExtra = [
      { ...items[0], privateNote: "nur für mich" },
    ] as unknown as PlaylistEntry[];
    expect(JSON.stringify(audienceEntries(withExtra))).not.toContain(
      "nur für mich",
    );
  });
});

describe("audienceBoard", () => {
  it("sends the board's scene without roster links", () => {
    const board = audienceBoard({
      scene: linkedScene(),
      step: 0,
      playback: { time: 1, playing: true },
      draft: null,
    });
    expect(JSON.stringify(board)).not.toContain("roster-7");
    expect(board.playback).toEqual({ time: 1, playing: true });
  });
});

describe("parsePresenterMessage", () => {
  it("reads back every message the presenter sends", () => {
    const entries = audienceEntries(items);
    const messages = [
      sessionMessage(entries, state),
      stateMessage({
        ...state,
        board: audienceBoard({
          scene: defaultScene(),
          step: 0,
          playback: null,
          draft: {
            id: "l1",
            tool: "curve",
            color: "white",
            width: "thin",
            style: "dotted",
            points: [
              { x: -2, y: 10 },
              { x: 30, y: 20 },
            ],
            step: 0,
          },
        }),
      }),
      pointerMessage({ x: 0.25, y: 0.75 }),
      pointerMessage(null),
      endMessage,
    ];
    for (const message of messages) {
      expect(parsePresenterMessage(delivered(message))).toEqual({
        ok: true,
        message,
      });
    }
  });

  it("reads back a board with a play line being drawn", () => {
    const message = stateMessage({
      ...state,
      board: audienceBoard({
        scene: defaultScene(),
        step: 0,
        playback: null,
        draft: {
          id: "l1",
          tool: "dribble",
          color: "yellow",
          width: "medium",
          style: "solid",
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 12 },
            { x: 30, y: 20 },
          ],
          step: 0,
        },
      }),
    });
    expect(parsePresenterMessage(delivered(message))).toEqual({
      ok: true,
      message,
    });
  });

  it("drops a message from another protocol version, saying so", () => {
    expect(
      parsePresenterMessage({
        ...endMessage,
        v: AUDIENCE_PROTOCOL_VERSION + 1,
      }),
    ).toEqual({ ok: false, reason: "version" });
  });

  it("drops garbled messages", () => {
    const entries = audienceEntries(items);
    const bad: unknown[] = [
      null,
      "end",
      [],
      { v: AUDIENCE_PROTOCOL_VERSION },
      { v: AUDIENCE_PROTOCOL_VERSION, type: "notes", text: "x" },
      // An index past the entries.
      sessionMessage(entries, { ...state, index: entries.length }),
      stateMessage({ ...state, index: -1 }),
      stateMessage({ ...state, card: { kind: "other", text: "x" } as never }),
      stateMessage({
        ...state,
        media: { ...state.media, rate: 0 },
      }),
      stateMessage({
        ...state,
        drawing: [{ ...state.drawing![0], color: "green" as never }],
      }),
      pointerMessage({ x: 1.5, y: 0 }),
      {
        v: AUDIENCE_PROTOCOL_VERSION,
        type: "session",
        entries: [{ kind: "clip", id: "a", title: "Tor" }],
        state,
      },
      {
        v: AUDIENCE_PROTOCOL_VERSION,
        type: "session",
        entries: [{ kind: "scene", id: "s", title: "S", scene: {}, holdS: 8 }],
        state,
      },
    ];
    for (const raw of bad) {
      expect(parsePresenterMessage(raw)).toEqual({
        ok: false,
        reason: "shape",
      });
    }
  });
});

describe("parseAudienceMessage", () => {
  it("reads back hello, bye and the commands", () => {
    for (const message of [
      helloMessage,
      byeMessage,
      commandMessage("next"),
      commandMessage("previous"),
      commandMessage("toggle-play"),
    ]) {
      expect(parseAudienceMessage(delivered(message))).toEqual({
        ok: true,
        message,
      });
    }
  });

  it("drops an unknown command and another version", () => {
    expect(
      parseAudienceMessage({
        v: AUDIENCE_PROTOCOL_VERSION,
        type: "command",
        command: "close",
      }),
    ).toEqual({ ok: false, reason: "shape" });
    expect(parseAudienceMessage({ v: 0, type: "hello" })).toEqual({
      ok: false,
      reason: "version",
    });
  });
});
