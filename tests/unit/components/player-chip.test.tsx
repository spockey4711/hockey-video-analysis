import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlayerChip } from "@/components/data/PlayerChip";
import {
  playerAvatarClass,
  playerInitials,
} from "@/components/data/player-identity";

afterEach(cleanup);

describe("player-identity", () => {
  it("derives up to two uppercase initials", () => {
    expect(playerInitials("Lena Vogt")).toBe("LV");
    expect(playerInitials("mara")).toBe("M");
    expect(playerInitials("  ")).toBe("?");
    expect(playerInitials("Anna Lea Berg")).toBe("AB");
  });

  it("is deterministic and token-based for a given name", () => {
    expect(playerAvatarClass("Lena Vogt")).toBe(playerAvatarClass("Lena Vogt"));
    expect(playerAvatarClass("Lena Vogt")).toMatch(/^bg-\[var\(--/);
  });
});

describe("PlayerChip", () => {
  it("shows initials and hides the name unless requested", () => {
    const { rerender } = render(
      <PlayerChip name="Lena Vogt" data-testid="chip" />,
    );
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent("LV");
    expect(chip).not.toHaveTextContent("Lena Vogt");
    rerender(<PlayerChip name="Lena Vogt" showName data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveTextContent("Lena Vogt");
  });

  it("renders the jersey number only when provided", () => {
    const { rerender } = render(
      <PlayerChip name="Lena Vogt" data-testid="chip" />,
    );
    expect(screen.getByTestId("chip")).not.toHaveTextContent("12");
    rerender(<PlayerChip name="Lena Vogt" number={12} data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveTextContent("12");
  });
});
