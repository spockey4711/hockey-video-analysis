import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The settings surface runs against a mocked token store and action: what
// matters is what the coach sees with and without a link, that replacing the
// link is confirm-gated while creating the first one is not, and that the
// action never hands the token back.
const mocks = vi.hoisted(() => ({
  getTeamShareToken: vi.fn(),
  regenerateTeamShareToken: vi.fn(),
  getCurrentCoach: vi.fn(),
  revalidatePath: vi.fn(),
  action: vi.fn(),
}));

vi.mock("@/features/share/team/token", () => ({
  getTeamShareToken: mocks.getTeamShareToken,
  regenerateTeamShareToken: mocks.regenerateTeamShareToken,
}));
vi.mock("@/lib/auth", () => ({ getCurrentCoach: mocks.getCurrentCoach }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { RegenerateTeamLinkForm } from "@/features/share/team/RegenerateTeamLinkForm";
import {
  TeamShareLink,
  TeamShareSettings,
} from "@/features/share/team/TeamShareLink";
import { regenerateTeamShareLinkAction } from "@/features/share/team/actions";
import { teamShareContent } from "@/features/share/team/content";

const { settings, coachLink } = teamShareContent;
const TOKEN = "c".repeat(64);
const COACH = { id: "coach-1", email: "coach@example.test", name: "Coach" };

beforeEach(() => {
  mocks.getCurrentCoach.mockResolvedValue(COACH);
  mocks.regenerateTeamShareToken.mockResolvedValue("d".repeat(64));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeamShareSettings", () => {
  it("shows the link and the confirm-gated replace control", async () => {
    mocks.getTeamShareToken.mockResolvedValue(TOKEN);
    render(await TeamShareSettings({ baseUrl: "https://app.example.test/" }));

    expect(screen.getByText(`/share/team/${TOKEN}`)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: settings.regenerate.submit }),
    ).toHaveAttribute("type", "button");
    expect(screen.getByText(settings.regenerate.hint)).toBeInTheDocument();
    expect(screen.queryByText(settings.disabled)).toBeNull();
  });

  it("says the team view is off and offers to create a link", async () => {
    mocks.getTeamShareToken.mockResolvedValue(undefined);
    render(await TeamShareSettings({}));

    expect(screen.getByText(settings.disabled)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: settings.create.submit }),
    ).toHaveAttribute("type", "submit");
    expect(screen.queryByText(/\/share\/team\//)).toBeNull();
  });
});

describe("TeamShareLink on the roster", () => {
  it("copies the link and points to the settings to replace it", async () => {
    mocks.getTeamShareToken.mockResolvedValue(TOKEN);
    render(await TeamShareLink({}));

    expect(screen.getByText(`/share/team/${TOKEN}`)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: coachLink.manageHint }),
    ).toHaveAttribute("href", "/settings#teilen");
    expect(
      screen.queryByRole("button", { name: settings.regenerate.submit }),
    ).toBeNull();
  });

  it("says where to create the link while there is none", async () => {
    mocks.getTeamShareToken.mockResolvedValue(undefined);
    render(await TeamShareLink({}));
    expect(screen.getByText(coachLink.disabled)).toBeInTheDocument();
  });
});

describe("RegenerateTeamLinkForm", () => {
  it("asks before replacing the link, and cancel leaves it alone", () => {
    render(<RegenerateTeamLinkForm hasLink />);

    fireEvent.click(
      screen.getByRole("button", { name: settings.regenerate.submit }),
    );
    expect(screen.getByText(settings.regenerate.confirm)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: settings.regenerate.confirmYes }),
    ).toHaveAttribute("type", "submit");

    fireEvent.click(
      screen.getByRole("button", { name: settings.regenerate.cancel }),
    );
    expect(screen.queryByText(settings.regenerate.confirm)).toBeNull();
    expect(mocks.regenerateTeamShareToken).not.toHaveBeenCalled();
  });

  it("replaces the link on confirm and says the old one stopped working", async () => {
    render(<RegenerateTeamLinkForm hasLink />);
    fireEvent.click(
      screen.getByRole("button", { name: settings.regenerate.submit }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: settings.regenerate.confirmYes }),
      );
    });

    expect(mocks.regenerateTeamShareToken).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      settings.regenerate.success,
    );
    expect(screen.queryByText(settings.regenerate.confirm)).toBeNull();
  });

  it("creates the first link in one click", async () => {
    render(<RegenerateTeamLinkForm hasLink={false} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: settings.create.submit }),
      );
    });

    expect(mocks.regenerateTeamShareToken).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      settings.create.success,
    );
  });
});

describe("regenerateTeamShareLinkAction", () => {
  it("replaces the token, refreshes both link pages, and never returns it", async () => {
    const state = await regenerateTeamShareLinkAction();

    expect(state).toEqual({ status: "success" });
    expect(mocks.regenerateTeamShareToken).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/players");
  });

  it("changes nothing without a coach session", async () => {
    mocks.getCurrentCoach.mockResolvedValue(null);
    await expect(regenerateTeamShareLinkAction()).resolves.toEqual({
      status: "error",
      error: settings.errors.unauthorized,
    });
    expect(mocks.regenerateTeamShareToken).not.toHaveBeenCalled();
  });

  it("reports a failed write without leaking the cause", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.regenerateTeamShareToken.mockRejectedValue(new Error("db down"));
    await expect(regenerateTeamShareLinkAction()).resolves.toEqual({
      status: "error",
      error: settings.errors.unexpected,
    });
  });
});
