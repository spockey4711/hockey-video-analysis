import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gameFormatContent } from "@/features/game-format/content";
import { DEFAULT_GAME_FORMAT } from "@/features/game-format/format";
import { GameForm } from "@/features/games/GameForm";
import { gamesContent } from "@/features/games/content";
import { readMediaDuration } from "@/features/games/read-media-duration";

vi.mock("@/features/games/actions", () => ({
  createGameAction: vi.fn(),
}));
vi.mock("@/features/games/read-media-duration", () => ({
  readMediaDuration: vi.fn(),
}));

const probe = vi.mocked(readMediaDuration);
const { create } = gamesContent;
const TEAM_FORMAT = DEFAULT_GAME_FORMAT;

beforeEach(() => {
  probe.mockReset();
});
afterEach(cleanup);

function typePath(value: string, index = 0) {
  const input = screen.getAllByLabelText(create.pathLabel)[index];
  fireEvent.change(input, { target: { value } });
}

function submittedDurations(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input[name="sourceDuration"]',
    ),
  ).map((input) => input.value);
}

describe("GameForm chapter durations", () => {
  it("has no field for typing a duration", () => {
    render(<GameForm teamFormat={TEAM_FORMAT} />);

    expect(screen.queryByRole("textbox", { name: /dauer/i })).toBeNull();
  });

  it("reads the length from the file the player will load", async () => {
    probe.mockResolvedValue(1218.4);
    const { container } = render(
      <GameForm
        teamFormat={TEAM_FORMAT}
        mediaBaseUrl="https://media.example/proxy"
      />,
    );

    typePath("2026-05-12/GX010123.MP4");

    expect(screen.getByText(create.durationPending)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: create.submit })).toBeDisabled();

    expect(await screen.findByText("20:18")).toBeInTheDocument();
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe.mock.calls[0][0]).toBe(
      "https://media.example/proxy/2026-05-12/GX010123.MP4",
    );
    expect(submittedDurations(container)).toEqual(["1218.4"]);
    expect(screen.getByRole("button", { name: create.submit })).toBeEnabled();
  });

  it("reads only the settled path while the coach is typing", async () => {
    probe.mockResolvedValue(60);
    render(<GameForm teamFormat={TEAM_FORMAT} />);

    typePath("/media/GX01");
    typePath("/media/GX010123.MP4");

    expect(await screen.findByText("01:00")).toBeInTheDocument();
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe.mock.calls[0][0]).toBe("/media/GX010123.MP4");
  });

  it("flags a file that cannot be read and submits no duration", async () => {
    probe.mockRejectedValue(new Error("404"));
    const { container } = render(<GameForm teamFormat={TEAM_FORMAT} />);

    typePath("/media/typo.MP4");

    expect(
      await screen.findByText(create.durationUnreadable),
    ).toBeInTheDocument();
    expect(submittedDurations(container)).toEqual([""]);
  });

  it("keeps each row's length when an earlier row is removed", async () => {
    probe.mockResolvedValueOnce(60).mockResolvedValueOnce(120);
    const { container } = render(<GameForm teamFormat={TEAM_FORMAT} />);

    typePath("/media/GX010123.MP4");
    expect(await screen.findByText("01:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: create.addSource }));
    typePath("/media/GX020123.MP4", 1);
    expect(await screen.findByText("02:00")).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: create.removeSource })[0],
    );

    expect(submittedDurations(container)).toEqual(["120"]);
    expect(probe).toHaveBeenCalledTimes(2);
  });
});

describe("GameForm format", () => {
  const { game } = gameFormatContent;

  function formValues(container: HTMLElement): Record<string, string> {
    const form = container.querySelector("form");
    if (!form) throw new Error("no form");
    return Object.fromEntries(
      [...new FormData(form).entries()]
        .filter(([name]) => !name.startsWith("source"))
        .map(([name, value]) => [name, String(value)]),
    );
  }

  it("starts on the team default and submits no own format", () => {
    const { container } = render(
      <GameForm teamFormat={{ periodCount: 2, periodLengthS: 1200 }} />,
    );

    const choice = screen.getByLabelText(game.choiceLabel);
    expect(choice).toHaveValue("team");
    expect(
      screen.getByRole("option", { name: "Teamstandard (2 x 20 Min.)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(gameFormatContent.periodCountLabel),
    ).toBeNull();
    expect(formValues(container)).toMatchObject({ formatChoice: "team" });
    expect(formValues(container)).not.toHaveProperty("periodCount");
  });

  it("sets an own format, seeded from the team default", () => {
    const { container } = render(<GameForm teamFormat={TEAM_FORMAT} />);

    fireEvent.change(screen.getByLabelText(game.choiceLabel), {
      target: { value: "custom" },
    });
    const count = screen.getByLabelText(gameFormatContent.periodCountLabel);
    const minutes = screen.getByLabelText(gameFormatContent.periodLengthLabel);
    expect(count).toHaveValue("4");
    expect(minutes).toHaveValue(15);

    fireEvent.change(count, { target: { value: "2" } });
    fireEvent.change(minutes, { target: { value: "20" } });

    expect(formValues(container)).toMatchObject({
      formatChoice: "custom",
      periodCount: "2",
      periodLengthMin: "20",
    });
  });
});
