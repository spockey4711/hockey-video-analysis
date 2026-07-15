import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GamesHeader } from "@/components/games/GamesHeader";
import { GamesList } from "@/components/games/GamesList";
import { GamesListSkeleton } from "@/components/games/GamesListSkeleton";
import { gamesContent, type GameListItem } from "@/features/games";

afterEach(cleanup);

const { list } = gamesContent;

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

describe("GamesList", () => {
  it("shows the empty-state copy when there are no games", () => {
    render(<GamesList games={[]} />);
    expect(screen.getByText(list.empty)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders one card per game linking into its watch view", () => {
    render(
      <GamesList
        games={[
          game(),
          game({
            id: "g2",
            title: "Auswaerts vs. Blau",
            opponent: "Blau",
            sourceCount: 1,
            totalDurationS: 600,
          }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("link");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("href", "/games/g1/watch");
    expect(rows[1]).toHaveAttribute("href", "/games/g2/watch");
    expect(screen.getByText("Heim vs. Rot-Weiss")).toBeInTheDocument();
    // Opponent and date fold into one meta line; the roll-up sits apart.
    expect(screen.getByText("vs. Rot-Weiss · 12.05.2026")).toBeInTheDocument();
    expect(screen.getByText("2 Kapitel")).toBeInTheDocument();
    expect(screen.getByText("1:02:03")).toBeInTheDocument();
  });

  it("falls back to the no-chapters label and omits the duration", () => {
    render(
      <GamesList
        games={[game({ opponent: null, playedOn: null, sourceCount: 0 })]}
      />,
    );
    expect(screen.getByText(list.noSources)).toBeInTheDocument();
    expect(screen.queryByText("1:02:03")).not.toBeInTheDocument();
  });
});

describe("GamesHeader", () => {
  it("offers the new-game action linking to the create page", () => {
    render(<GamesHeader />);
    expect(
      screen.getByRole("heading", { name: list.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: list.newGame })).toHaveAttribute(
      "href",
      "/games/new",
    );
  });
});

describe("GamesListSkeleton", () => {
  it("exposes a labelled status region while loading", () => {
    render(<GamesListSkeleton />);
    expect(screen.getByRole("status")).toHaveAccessibleName(list.loading);
  });
});
