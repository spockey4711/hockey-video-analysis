import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the server actions so importing the forms does not pull the auth/db
// chain into the test.
vi.mock("@/features/games/actions", () => ({
  acceptImportedGameAction: vi.fn(async () => ({})),
  discardImportedGameAction: vi.fn(async () => ({})),
}));

import { IncomingGamesList } from "@/components/games/IncomingGamesList";
import { DiscardGameForm } from "@/features/games/DiscardGameForm";
import { ReviewGameForm } from "@/features/games/ReviewGameForm";
import { gamesContent } from "@/features/games/content";
import type { GameListItem } from "@/features/games/queries";

afterEach(cleanup);

const { incoming, list, review } = gamesContent;
const GAME_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function importedGame(overrides: Partial<GameListItem> = {}): GameListItem {
  return {
    id: "g1",
    title: "",
    opponent: null,
    playedOn: "2026-05-12",
    createdAt: new Date("2026-05-12T10:00:00Z"),
    sourceCount: 3,
    totalDurationS: 4200,
    ...overrides,
  };
}

describe("IncomingGamesList", () => {
  it("renders nothing when no imported game is waiting", () => {
    const { container } = render(<IncomingGamesList games={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each waiting game with a link to its review", () => {
    render(
      <IncomingGamesList
        games={[importedGame(), importedGame({ id: "g2", playedOn: null })]}
      />,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent(incoming.heading);
    // The count badge tells the coach how many games are waiting.
    expect(heading).toHaveTextContent("2");
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/games/g1/review",
      "/games/g2/review",
    ]);
    expect(screen.getAllByText(list.unnamed)).toHaveLength(2);
    expect(screen.getByText("12.05.2026")).toBeInTheDocument();
    // An import without a trustworthy date says so instead of showing nothing.
    expect(screen.getByText(incoming.dateMissing)).toBeInTheDocument();
  });
});

describe("ReviewGameForm", () => {
  it("pre-fills the imported recording date", () => {
    render(<ReviewGameForm gameId={GAME_ID} playedOn="2026-05-12" />);
    expect(screen.getByLabelText(review.playedOnLabel)).toHaveValue(
      "2026-05-12",
    );
    expect(screen.queryByText(review.dateMissingHint)).not.toBeInTheDocument();
  });

  it("asks for the date when the import had none", () => {
    render(<ReviewGameForm gameId={GAME_ID} playedOn={null} />);
    expect(screen.getByLabelText(review.playedOnLabel)).toHaveValue("");
    expect(screen.getByText(review.dateMissingHint)).toBeInTheDocument();
  });
});

describe("DiscardGameForm", () => {
  it("gates the deletion behind a confirm step", () => {
    render(<DiscardGameForm gameId={GAME_ID} />);
    expect(
      screen.queryByRole("button", { name: review.discardYes }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: review.discard }));

    expect(screen.getByText(review.discardConfirm)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: review.discardYes }),
    ).toHaveAttribute("type", "submit");
  });

  it("returns to the trigger when the coach cancels", () => {
    render(<DiscardGameForm gameId={GAME_ID} />);
    fireEvent.click(screen.getByRole("button", { name: review.discard }));
    fireEvent.click(screen.getByRole("button", { name: review.cancel }));

    expect(screen.queryByText(review.discardConfirm)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: review.discard }),
    ).toBeInTheDocument();
  });
});
