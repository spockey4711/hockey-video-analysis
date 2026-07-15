import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HotkeyHints } from "@/components/watch/HotkeyHints";
import { watchContent } from "@/components/watch/content";
import { buildWatchHotkeyGroups } from "@/components/watch/hotkey-groups";
import { TAG_TYPES } from "@/lib/tag-types";

afterEach(cleanup);

describe("HotkeyHints", () => {
  it("renders each hint's keys as kbd caps beside its label", () => {
    render(
      <HotkeyHints
        groups={[
          {
            title: "Zeitleiste",
            hints: [{ keys: ["←", "→"], label: "Suchen" }],
          },
        ]}
      />,
    );

    const item = screen.getByText("Suchen").closest("li");
    expect(item).not.toBeNull();
    const caps = within(item as HTMLElement).getAllByText(/[←→]/);
    expect(caps.map((cap) => cap.tagName)).toEqual(["KBD", "KBD"]);
  });

  it("is labelled by its title for assistive tech", () => {
    render(<HotkeyHints groups={[]} />);
    expect(
      screen.getByRole("region", { name: watchContent.hotkeys.title }),
    ).toBeInTheDocument();
  });
});

describe("buildWatchHotkeyGroups", () => {
  it("lists every tag type with its uppercased hotkey", () => {
    const groups = buildWatchHotkeyGroups();
    const tagging = groups.find(
      (group) => group.title === watchContent.hotkeys.groups.tagging,
    );

    expect(tagging?.hints).toHaveLength(TAG_TYPES.length);
    for (const type of TAG_TYPES) {
      const hint = tagging?.hints.find((h) => h.label === type.label);
      expect(hint?.keys).toEqual([type.hotkey.toUpperCase()]);
    }
  });

  it("documents timeline navigation as a distinct group", () => {
    const groups = buildWatchHotkeyGroups();
    expect(
      groups.some(
        (group) => group.title === watchContent.hotkeys.groups.timeline,
      ),
    ).toBe(true);
  });
});
