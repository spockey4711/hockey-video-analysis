"use client";

/**
 * The presenter's end of a presentation on a second screen (ADR 0015): it
 * opens the audience window, answers its `hello` with everything it shows,
 * keeps it in step, and tells it `end` when the presentation closes or the
 * presenter window goes away. An audience window closed or reloaded says
 * `bye`, then (reloaded) `hello` again, and gets the whole state anew - so a
 * resync is just another `hello`.
 *
 * The controller outlives the open presentation: it lives with the launch
 * buttons, so closing and reopening the presentation finds the projector
 * window where it was and puts the presentation back on it. Nothing is
 * stored; both windows' roles live in this browser only.
 */
import { useEffect, useMemo, useState } from "react";

import {
  audienceChannelName,
  AUDIENCE_WINDOW_NAME,
  audienceUrl,
  endMessage,
  parseAudienceMessage,
  pointerMessage,
  sessionMessage,
  stateMessage,
  type AudienceCommand,
  type AudienceEntry,
  type AudienceState,
  type PresenterMessage,
} from "./audience-protocol";
import {
  audienceWindowFeatures,
  grantedScreens,
  moveToScreen,
  otherScreen,
  requestScreens,
  type ScreensLike,
} from "./audience-window";

import type { PicturePoint } from "@/features/player/telestration/geometry";

/**
 * `off`: one window. `opening`: the audience window is on its way (or
 * reloading). `live`: it answered and shows the presentation. `blocked`: the
 * browser did not open it.
 */
export type AudienceStatus = "off" | "opening" | "live" | "blocked";

/** What the open presentation hands the link. */
export interface AudienceSource {
  /** The entries as the audience gets them (see `audienceEntries`). */
  readonly entries: readonly AudienceEntry[];
  /** What the audience shows right now. */
  readonly state: () => AudienceState;
  /** A key pressed in the audience window, meant for the presenter. */
  readonly command: (command: AudienceCommand) => void;
}

export interface AudienceController {
  /** Open the audience window, or bring it back; call from a click. */
  readonly open: () => void;
  /** Close the audience window and go back to one window. */
  readonly close: () => void;
  /** Whether an audience window is up or on its way; for event handlers. */
  readonly isOn: () => boolean;
  /** Put the open presentation on the audience window; returns the detach. */
  readonly attach: (source: AudienceSource) => () => void;
  /** Send what changed; `force` sends even an unchanged state. */
  readonly sync: (force?: boolean) => void;
  /** Send the pointer's spot on the picture, or `null` when it left it. */
  readonly point: (at: PicturePoint | null) => void;
  /** Listen for the window going away; returns the cleanup. */
  readonly start: () => () => void;
}

export interface AudienceLink extends AudienceController {
  readonly status: AudienceStatus;
}

/** The channel as the controller uses it. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

/** The browser around the controller, swapped for fakes in tests. */
export interface AudienceHost {
  readonly openWindow: (
    url: string,
    name: string,
    features: string,
  ) => Window | null;
  readonly createChannel: (name: string) => ChannelLike | null;
  readonly newSessionId: () => string;
}

/** How often the presenter checks on the window and resends the clock, in ms. */
export const HEARTBEAT_MS = 1000;

const browserHost: AudienceHost = {
  openWindow: (url, name, features) => window.open(url, name, features),
  createChannel: (name) =>
    typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(name),
  newSessionId: () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
};

/**
 * The part of the state that says the audience must redraw. A playing clip's
 * time moves on by itself, so it is left out; the heartbeat carries it.
 */
function changeKey(state: AudienceState): string {
  const { media } = state;
  return JSON.stringify({
    ...state,
    media: {
      playing: media.playing,
      held: media.held,
      rate: media.rate,
      time: media.playing ? null : media.time,
    },
  });
}

export function createAudienceController(
  onStatus: (status: AudienceStatus) => void,
  host: AudienceHost = browserHost,
): AudienceController {
  let status: AudienceStatus = "off";
  let sessionId: string | null = null;
  let channel: ChannelLike | null = null;
  let target: Window | null = null;
  let source: AudienceSource | null = null;
  let lastKey: string | null = null;
  let screens: ScreensLike | null = null;

  function update(next: AudienceStatus): void {
    if (next === status) return;
    status = next;
    onStatus(next);
  }

  function isOn(): boolean {
    return status === "opening" || status === "live";
  }

  function post(message: PresenterMessage): void {
    channel?.postMessage(message);
  }

  /** Everything the audience shows, or `end` while no presentation is open. */
  function sendSession(): void {
    if (!source) {
      post(endMessage);
      return;
    }
    const state = source.state();
    lastKey = changeKey(state);
    post(sessionMessage(source.entries, state));
  }

  function connect(): ChannelLike | null {
    if (channel) return channel;
    sessionId ??= host.newSessionId();
    channel = host.createChannel(audienceChannelName(sessionId));
    if (!channel) return null;
    channel.onmessage = (event) => {
      const parsed = parseAudienceMessage(event.data);
      if (!parsed.ok) return;
      const { message } = parsed;
      if (message.type === "hello") {
        update("live");
        sendSession();
      } else if (message.type === "bye") {
        // Reloading says hello again; closed, the heartbeat finds it gone.
        update(target ? "opening" : "off");
      } else {
        source?.command(message.command);
      }
    };
    return channel;
  }

  function open(): void {
    if (!connect() || !sessionId) {
      update("blocked");
      return;
    }
    const screen = otherScreen(screens);
    const opened = host.openWindow(
      audienceUrl(sessionId),
      AUDIENCE_WINDOW_NAME,
      audienceWindowFeatures(screen),
    );
    if (!opened) {
      update("blocked");
      return;
    }
    target = opened;
    opened.focus();
    if (status !== "live") update("opening");
    if (screen || !hasOtherScreen()) return;
    // Asking may take a prompt; the window is open meanwhile and moves over
    // once the browser tells where the other screen is.
    void requestScreens().then((details) => {
      screens = details ?? screens;
      const other = otherScreen(details);
      if (other && target === opened) moveToScreen(opened, other);
    });
  }

  function close(): void {
    post(endMessage);
    target?.close();
    target = null;
    update("off");
  }

  function attach(next: AudienceSource): () => void {
    source = next;
    lastKey = null;
    if (isOn()) sendSession();
    return () => {
      if (source !== next) return;
      source = null;
      post(endMessage);
    };
  }

  function sync(force = false): void {
    if (status !== "live" || !source) return;
    const state = source.state();
    const key = changeKey(state);
    if (!force && key === lastKey) return;
    lastKey = key;
    post(stateMessage(state));
  }

  function point(at: PicturePoint | null): void {
    if (status === "live") post(pointerMessage(at));
  }

  function start(): () => void {
    let active = true;
    if (hasOtherScreen()) {
      void grantedScreens().then((details) => {
        if (active) screens = details;
      });
    }
    const heartbeat = setInterval(() => {
      if (target?.closed) {
        target = null;
        update("off");
      }
      sync(true);
    }, HEARTBEAT_MS);
    // The presenter window closing or reloading ends the presentation there.
    const leave = () => post(endMessage);
    window.addEventListener("pagehide", leave);
    return () => {
      active = false;
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", leave);
      post(endMessage);
      channel?.close();
      channel = null;
    };
  }

  return { open, close, isOn, attach, sync, point, start };
}

/** Whether the device has more than one screen, where the browser tells. */
function hasOtherScreen(): boolean {
  const screen = window.screen as Screen & { isExtended?: boolean };
  return screen.isExtended === true;
}

/** The presenter's link to the audience window, for the launch buttons' owner. */
export function useAudienceLink(): AudienceLink {
  const [status, setStatus] = useState<AudienceStatus>("off");
  const [controller] = useState(() => createAudienceController(setStatus));
  useEffect(() => controller.start(), [controller]);
  return useMemo(() => ({ ...controller, status }), [controller, status]);
}
