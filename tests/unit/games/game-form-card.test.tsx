import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GameFormCard } from "@/components/games/GameFormCard";
import { gamesContent } from "@/features/games";

afterEach(cleanup);

const { create } = gamesContent;

describe("GameFormCard", () => {
  it("frames its children under the create title and subtitle", () => {
    render(
      <GameFormCard>
        <button type="button">Spiel anlegen</button>
      </GameFormCard>,
    );

    expect(
      screen.getByRole("heading", { name: create.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(create.subtitle)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Spiel anlegen" }),
    ).toBeInTheDocument();
  });
});
