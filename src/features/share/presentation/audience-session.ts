/**
 * What the audience window shows, as a pure reducer over the presenter's
 * messages (ADR 0015). It waits until the presenter sends the session, shows
 * it and follows each state, and falls back to a neutral end once the
 * presenter says so - never to any of the presentation. The pointer's spot
 * moves many times a second, so it bypasses this and goes straight to the dot.
 */
import type {
  AudienceEntry,
  AudienceState,
  PresenterMessage,
} from "./audience-protocol";

export type AudienceSession =
  /** Nothing from the presenter yet. */
  | { readonly kind: "waiting" }
  | {
      readonly kind: "live";
      readonly entries: readonly AudienceEntry[];
      readonly state: AudienceState;
    }
  /** The presentation closed, or the presenter window went away. */
  | { readonly kind: "ended" }
  /** The presenter runs another version of the protocol. */
  | { readonly kind: "other-version" };

export const waitingSession: AudienceSession = { kind: "waiting" };

export function audienceSessionReducer(
  session: AudienceSession,
  message: PresenterMessage | "other-version",
): AudienceSession {
  if (message === "other-version") return { kind: "other-version" };
  switch (message.type) {
    case "session":
      return { kind: "live", entries: message.entries, state: message.state };
    case "state":
      // A state belongs to the session it follows; one out of range waits
      // for the next session.
      if (session.kind !== "live") return session;
      if (message.state.index >= session.entries.length) return session;
      return { ...session, state: message.state };
    case "end":
      // Before any session there is nothing to end; the window keeps waiting.
      return session.kind === "waiting" ? session : { kind: "ended" };
    case "pointer":
      return session;
  }
}
