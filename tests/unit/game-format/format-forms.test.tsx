import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/game-format/actions", () => ({
  setTeamGameFormatAction: vi.fn(),
  updateGameFormatAction: vi.fn(),
}));

import { GameFormatForm } from "@/features/game-format/GameFormatForm";
import { TeamFormatForm } from "@/features/game-format/TeamFormatForm";
import { gameFormatContent } from "@/features/game-format/content";

const { game, team } = gameFormatContent;
const GAME_ID = "11111111-1111-4111-8111-111111111111";

afterEach(cleanup);

function formValues(): Record<string, string> {
  const form = document.querySelector("form");
  if (!form) throw new Error("no form");
  return Object.fromEntries(
    [...new FormData(form).entries()].map(([name, value]) => [
      name,
      String(value),
    ]),
  );
}

describe("TeamFormatForm", () => {
  it("shows the stored team default and submits the edited one", () => {
    render(<TeamFormatForm format={{ periodCount: 4, periodLengthS: 900 }} />);

    const count = screen.getByLabelText(gameFormatContent.periodCountLabel);
    const minutes = screen.getByLabelText(gameFormatContent.periodLengthLabel);
    expect(count).toHaveValue("4");
    expect(minutes).toHaveValue(15);
    expect(
      screen.getByRole("option", { name: "2 Halbzeiten" }),
    ).toBeInTheDocument();

    fireEvent.change(count, { target: { value: "2" } });
    fireEvent.change(minutes, { target: { value: "20" } });

    expect(formValues()).toEqual({ periodCount: "2", periodLengthMin: "20" });
    expect(screen.getByRole("button", { name: team.submit })).toBeEnabled();
  });

  it("says that games with marked periods keep their format", () => {
    render(<TeamFormatForm format={{ periodCount: 2, periodLengthS: 1200 }} />);
    expect(screen.getByText(team.hint)).toBeInTheDocument();
  });
});

describe("GameFormatForm", () => {
  const teamDefault = { periodCount: 4, periodLengthS: 900 } as const;

  it("opens a game with its own format on that format", () => {
    render(
      <GameFormatForm
        gameId={GAME_ID}
        teamDefault={teamDefault}
        format={{ periodCount: 2, periodLengthS: 1500 }}
        markedPeriods={0}
      />,
    );

    expect(screen.getByLabelText(game.choiceLabel)).toHaveValue("custom");
    expect(formValues()).toEqual({
      gameId: GAME_ID,
      formatChoice: "custom",
      periodCount: "2",
      periodLengthMin: "25",
    });
  });

  it("puts a game back on the team default", () => {
    render(
      <GameFormatForm
        gameId={GAME_ID}
        teamDefault={teamDefault}
        format={{ periodCount: 2, periodLengthS: 1200 }}
        markedPeriods={2}
      />,
    );

    fireEvent.change(screen.getByLabelText(game.choiceLabel), {
      target: { value: "team" },
    });

    expect(formValues()).toEqual({ gameId: GAME_ID, formatChoice: "team" });
  });

  it("warns before two halves remove the marked 3rd and 4th quarter", () => {
    render(
      <GameFormatForm
        gameId={GAME_ID}
        teamDefault={teamDefault}
        format={null}
        markedPeriods={4}
      />,
    );
    expect(screen.queryByText(game.dropWarning(3))).toBeNull();

    fireEvent.change(screen.getByLabelText(game.choiceLabel), {
      target: { value: "custom" },
    });
    fireEvent.change(
      screen.getByLabelText(gameFormatContent.periodCountLabel),
      { target: { value: "2" } },
    );

    expect(screen.getByText(game.dropWarning(3))).toBeInTheDocument();
  });
});
