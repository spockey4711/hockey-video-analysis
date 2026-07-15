import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HotkeyTagger } from "@/features/tagging/HotkeyTagger";

const gameId = "11111111-1111-4111-8111-111111111111";

function mockFetchOk(tag: Record<string, unknown>): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => ({ tag }),
  })) as unknown as typeof fetch;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HotkeyTagger", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk({ id: "tag-1", type: "goal", startS: 90, endS: 105 }),
    );
  });

  it("captures the current time on a bound key and posts the window", async () => {
    const onCaptured = vi.fn();
    render(
      <HotkeyTagger
        gameId={gameId}
        getCurrentTimeS={() => 100}
        onCaptured={onCaptured}
      />,
    );

    fireEvent.keyDown(window, { key: "t" });

    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/tags",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toEqual({ gameId, type: "goal", startS: 90, endS: 105 });
    expect(onCaptured).toHaveBeenCalledWith({
      id: "tag-1",
      type: "goal",
      startS: 90,
      endS: 105,
    });
    expect(screen.getByRole("status").textContent).toContain("Tor");
  });

  it("ignores keys that are not bound to a tag type", () => {
    render(<HotkeyTagger gameId={gameId} getCurrentTimeS={() => 100} />);
    fireEvent.keyDown(window, { key: "z" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores hotkeys pressed with a modifier", () => {
    render(<HotkeyTagger gameId={gameId} getCurrentTimeS={() => 100} />);
    fireEvent.keyDown(window, { key: "t", metaKey: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not hijack keys typed into a text field", () => {
    render(
      <>
        <input aria-label="note" />
        <HotkeyTagger gameId={gameId} getCurrentTimeS={() => 100} />
      </>,
    );
    const input = screen.getByLabelText("note");
    input.focus();
    fireEvent.keyDown(input, { key: "t" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not capture while disabled", () => {
    render(
      <HotkeyTagger
        gameId={gameId}
        getCurrentTimeS={() => 100}
        enabled={false}
      />,
    );
    fireEvent.keyDown(window, { key: "t" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces a save failure through onError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) })),
    );
    const onError = vi.fn();
    render(
      <HotkeyTagger
        gameId={gameId}
        getCurrentTimeS={() => 100}
        onError={onError}
      />,
    );

    fireEvent.keyDown(window, { key: "t" });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).not.toBe("");
  });
});
