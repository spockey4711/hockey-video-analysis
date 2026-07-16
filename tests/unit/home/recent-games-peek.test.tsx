import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { GameListItem } from "@/features/games";
import { homeContent } from "@/features/home";
import { RecentGamesPeek } from "@/features/home/RecentGamesPeek";

afterEach(cleanup);

const { signedIn } = homeContent;

function game(overrides: Partial<GameListItem> = {}): GameListItem {
  return {
    id: "g1",
    title: "Heim vs. Rot-Weiss",
    opponent: "Rot-Weiss",
    playedOn: "2026-05-12",
    createdAt: new Date("2026-05-12T10:00:00Z"),
    sourceCount: 2,
    totalDurationS: 3723,
    ...overrides,
  };
}

describe("RecentGamesPeek", () => {
  it("shows the empty-state copy when there are no games", () => {
    render(<RecentGamesPeek games={[]} />);
    expect(screen.getByText(signedIn.recentEmpty.title)).toBeInTheDocument();
    // The "all games" link is always offered, even when empty.
    expect(
      screen.getByRole("link", { name: signedIn.recentAll }),
    ).toHaveAttribute("href", "/games");
  });

  it("links each game to its watch view with title and meta", () => {
    render(
      <RecentGamesPeek
        games={[
          game(),
          game({ id: "g2", title: "Auswaerts vs. Blau", opponent: "Blau" }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("link", { name: /vs\./ });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("href", "/games/g1/watch");
    expect(rows[1]).toHaveAttribute("href", "/games/g2/watch");
    expect(screen.getByText("Heim vs. Rot-Weiss")).toBeInTheDocument();
    // Opponent, date and the chapter roll-up are folded into one meta line.
    expect(
      screen.getByText(/vs\. Rot-Weiss · 12\.05\.2026 · 2 Kapitel · 1:02:03/),
    ).toBeInTheDocument();
  });

  it("falls back to the no-chapters label when a game has no sources", () => {
    render(
      <RecentGamesPeek
        games={[game({ opponent: null, playedOn: null, sourceCount: 0 })]}
      />,
    );
    expect(screen.getByText("Keine Kapitel")).toBeInTheDocument();
  });
});
