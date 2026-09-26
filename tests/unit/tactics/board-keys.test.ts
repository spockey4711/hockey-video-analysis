import { describe, expect, it } from "vitest";

import {
  boardKeyAction,
  TOOL_KEYS,
  toolKey,
  type BoardKeyEvent,
} from "@/features/tactics/board-keys";

const idle = { playback: null, width: "medium" } as const;

function press(key: string, extra: Partial<BoardKeyEvent> = {}): BoardKeyEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: document.body,
    ...extra,
  };
}

describe("boardKeyAction", () => {
  it("picks moving and the play tools by their keys", () => {
    const modes = ["v", "l", "P", "d", "s"].map((key) =>
      boardKeyAction(press(key), idle),
    );
    expect(modes).toEqual(
      ["move", "run", "pass", "dribble", "block"].map((mode) => ({
        type: "setMode",
        mode,
      })),
    );
  });

  it("names each play tool's key", () => {
    expect(TOOL_KEYS.map(({ key }) => key)).toEqual(["v", "l", "p", "d", "s"]);
    expect(toolKey("dribble")).toBe("d");
    expect(toolKey("curve")).toBeUndefined();
  });

  it("maps the board keys to their actions", () => {
    expect(boardKeyAction(press("o"), idle)).toEqual({
      type: "toggleLineStyle",
    });
    expect(boardKeyAction(press("W"), idle)).toEqual({
      type: "setWidth",
      width: "thick",
    });
    expect(boardKeyAction(press("b"), idle)).toEqual({ type: "stepBack" });
    expect(boardKeyAction(press("n"), idle)).toEqual({ type: "stepForward" });
  });

  it("plays at rest and pauses while playing on the space bar", () => {
    expect(boardKeyAction(press(" "), idle)).toEqual({ type: "play" });
    expect(
      boardKeyAction(press(" "), {
        ...idle,
        playback: { time: 1, playing: true },
      }),
    ).toEqual({ type: "pause" });
  });

  it("leaves the space bar to a focused button", () => {
    const button = document.createElement("button");
    expect(boardKeyAction(press(" ", { target: button }), idle)).toBeNull();
  });

  it("undoes on Ctrl+Z or Cmd+Z and ignores other modifier combinations", () => {
    expect(boardKeyAction(press("z", { ctrlKey: true }), idle)).toEqual({
      type: "undo",
    });
    expect(boardKeyAction(press("z", { metaKey: true }), idle)).toEqual({
      type: "undo",
    });
    expect(boardKeyAction(press("o", { ctrlKey: true }), idle)).toBeNull();
    expect(boardKeyAction(press("o", { altKey: true }), idle)).toBeNull();
  });

  it("leaves typing in a field and keys without a shortcut alone", () => {
    const input = document.createElement("input");
    expect(boardKeyAction(press("o", { target: input }), idle)).toBeNull();
    expect(boardKeyAction(press("t"), idle)).toBeNull();
    expect(boardKeyAction(press("ArrowRight"), idle)).toBeNull();
  });
});
