import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAudienceController,
  HEARTBEAT_MS,
  type AudienceHost,
  type AudienceSource,
  type AudienceStatus,
  type ChannelLike,
} from "@/features/share/presentation/audience-link";
import {
  AUDIENCE_WINDOW_NAME,
  byeMessage,
  commandMessage,
  helloMessage,
  type AudienceState,
  type PresenterMessage,
} from "@/features/share/presentation/audience-protocol";

/** One end of the channel: records what the presenter sends. */
class FakeChannel implements ChannelLike {
  readonly sent: PresenterMessage[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;
  constructor(readonly name: string) {}
  postMessage(message: unknown): void {
    this.sent.push(structuredClone(message) as PresenterMessage);
  }
  close(): void {
    this.closed = true;
  }
  /** The audience window says something. */
  hear(message: unknown): void {
    this.onmessage?.({ data: structuredClone(message) } as MessageEvent);
  }
  types(): string[] {
    return this.sent.map((message) => message.type);
  }
}

interface FakeWindow {
  closed: boolean;
  focus: () => void;
  close: () => void;
  moveTo: () => void;
  resizeTo: () => void;
}

function fakeWindow(): FakeWindow {
  const win: FakeWindow = {
    closed: false,
    focus: vi.fn(),
    close: vi.fn(() => {
      win.closed = true;
    }),
    moveTo: vi.fn(),
    resizeTo: vi.fn(),
  };
  return win;
}

const state: AudienceState = {
  index: 0,
  card: null,
  showMarks: true,
  drawing: null,
  pointer: false,
  board: null,
  media: { playing: false, held: false, time: 0, rate: 1, at: 0 },
};

function setup(options: { blocked?: boolean } = {}) {
  const statuses: AudienceStatus[] = [];
  let channel: FakeChannel | null = null;
  const win = fakeWindow();
  const openWindow = vi.fn(() =>
    options.blocked ? null : (win as unknown as Window),
  );
  const host: AudienceHost = {
    openWindow,
    createChannel: (name) => (channel = new FakeChannel(name)),
    newSessionId: () => "0123456789abcdef",
  };
  const controller = createAudienceController(
    (status) => statuses.push(status),
    host,
  );
  let current = state;
  const commands: string[] = [];
  const source: AudienceSource = {
    entries: [{ kind: "clip", id: "a", src: "/a.mp4", title: "Tor" }],
    state: () => current,
    command: (command) => commands.push(command),
  };
  return {
    controller,
    statuses,
    win,
    openWindow,
    source,
    commands,
    channel: () => channel!,
    setState(next: AudienceState) {
      current = next;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAudienceController", () => {
  it("opens the audience window by name at its session's address", () => {
    const { controller, openWindow, statuses, win } = setup();
    controller.open();
    expect(openWindow).toHaveBeenCalledWith(
      "/share/present#0123456789abcdef",
      AUDIENCE_WINDOW_NAME,
      "popup,width=1280,height=720",
    );
    expect(win.focus).toHaveBeenCalled();
    expect(statuses).toEqual(["opening"]);
    expect(controller.isOn()).toBe(true);
  });

  it("says when the browser blocked the window", () => {
    const { controller, statuses } = setup({ blocked: true });
    controller.open();
    expect(statuses).toEqual(["blocked"]);
    expect(controller.isOn()).toBe(false);
  });

  it("answers the audience's hello with the whole session", () => {
    const { controller, statuses, source, channel } = setup();
    controller.attach(source);
    controller.open();
    channel().hear(helloMessage);
    expect(statuses).toEqual(["opening", "live"]);
    expect(channel().name).toBe("hva-presentation:0123456789abcdef");
    const last = channel().sent.at(-1);
    expect(last).toMatchObject({
      type: "session",
      entries: source.entries,
      state,
    });
  });

  it("resyncs a reloaded audience window with the state of now", () => {
    const { controller, statuses, source, channel, setState } = setup();
    controller.attach(source);
    controller.open();
    channel().hear(helloMessage);
    setState({ ...state, index: 0, showMarks: false });
    channel().hear(byeMessage);
    expect(statuses.at(-1)).toBe("opening");
    channel().hear(helloMessage);
    expect(statuses.at(-1)).toBe("live");
    expect(channel().sent.at(-1)).toMatchObject({
      type: "session",
      state: { showMarks: false },
    });
  });

  it("tells a window with no presentation open that it ended", () => {
    const { controller, channel } = setup();
    controller.open();
    channel().hear(helloMessage);
    expect(channel().types()).toEqual(["end"]);
  });

  it("sends a changed state once, and the clock on the heartbeat", () => {
    const { controller, source, channel, setState } = setup();
    const stop = controller.start();
    controller.attach(source);
    controller.open();
    channel().hear(helloMessage);
    const before = channel().sent.length;
    controller.sync();
    expect(channel().sent.length).toBe(before);
    setState({ ...state, index: 0, pointer: true });
    controller.sync();
    controller.sync();
    expect(channel().types().slice(before)).toEqual(["state"]);
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(channel().types().slice(before)).toEqual(["state", "state"]);
    stop();
  });

  it("sends nothing before the audience window answered", () => {
    const { controller, source, channel } = setup();
    controller.attach(source);
    controller.open();
    controller.sync(true);
    controller.point({ x: 0.5, y: 0.5 });
    expect(channel().types()).toEqual([]);
  });

  it("ends the audience's presentation when the presentation closes", () => {
    const { controller, source, channel } = setup();
    const detach = controller.attach(source);
    controller.open();
    channel().hear(helloMessage);
    detach();
    expect(channel().types().at(-1)).toBe("end");
    controller.sync(true);
    expect(channel().types().at(-1)).toBe("end");
  });

  it("closes the audience window and goes back to one window", () => {
    const { controller, win, statuses, channel } = setup();
    controller.open();
    channel().hear(helloMessage);
    controller.close();
    expect(win.close).toHaveBeenCalled();
    expect(statuses.at(-1)).toBe("off");
    expect(channel().types().at(-1)).toBe("end");
  });

  it("notices the audience window closed by hand", () => {
    const { controller, win, statuses } = setup();
    const stop = controller.start();
    controller.open();
    win.closed = true;
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(statuses.at(-1)).toBe("off");
    stop();
  });

  it("passes the audience window's keys on to the presentation", () => {
    const { controller, source, channel, commands } = setup();
    controller.attach(source);
    controller.open();
    channel().hear(helloMessage);
    channel().hear(commandMessage("next"));
    channel().hear({ v: 1, type: "command", command: "delete" });
    expect(commands).toEqual(["next"]);
  });

  it("says end as the presenter window goes away", () => {
    const { controller, channel } = setup();
    const stop = controller.start();
    controller.open();
    window.dispatchEvent(new Event("pagehide"));
    expect(channel().types().at(-1)).toBe("end");
    stop();
    expect(channel().closed).toBe(true);
  });
});
