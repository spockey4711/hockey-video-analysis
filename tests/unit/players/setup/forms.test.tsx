import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the server action module so importing the forms does not pull the
// auth/db chain into the test, and stub the router the forms refresh on success.
const { mockRefresh, actions } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  actions: { createPlayerAction: vi.fn(), updatePlayerAction: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));
vi.mock("@/features/players/setup/actions", () => actions);

import { AddPlayerForm } from "@/features/players/setup/AddPlayerForm";
import { EditablePlayerName } from "@/features/players/setup/EditablePlayerName";
import { playerSetupContent } from "@/features/players/setup/content";

const PLAYER_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

function nameInput(): HTMLInputElement {
  return screen.getByLabelText(playerSetupContent.nameLabel);
}
function jerseyInput(): HTMLInputElement {
  return screen.getByLabelText(playerSetupContent.jerseyLabel);
}

describe("AddPlayerForm", () => {
  it("submits the fields, then clears them and refreshes the roster", async () => {
    actions.createPlayerAction.mockResolvedValue({ status: "success" });
    render(<AddPlayerForm />);

    fireEvent.change(nameInput(), { target: { value: "Alex Muster" } });
    fireEvent.change(jerseyInput(), { target: { value: "7" } });
    fireEvent.click(
      screen.getByRole("button", { name: playerSetupContent.addAction }),
    );

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    const submitted = actions.createPlayerAction.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("name")).toBe("Alex Muster");
    expect(submitted.get("jerseyNumber")).toBe("7");
    expect(nameInput().value).toBe("");
    expect(jerseyInput().value).toBe("");
    expect(screen.getByRole("status")).toHaveTextContent(
      playerSetupContent.added,
    );
  });

  it("keeps the typed values and shows field errors on a rejected submit", async () => {
    actions.createPlayerAction.mockResolvedValue({
      status: "error",
      fieldErrors: { jerseyNumber: playerSetupContent.errors.jerseyInvalid },
    });
    render(<AddPlayerForm />);

    fireEvent.change(nameInput(), { target: { value: "Alex" } });
    fireEvent.change(jerseyInput(), { target: { value: "100" } });
    fireEvent.click(
      screen.getByRole("button", { name: playerSetupContent.addAction }),
    );

    expect(
      await screen.findByText(playerSetupContent.errors.jerseyInvalid),
    ).toBeInTheDocument();
    expect(nameInput().value).toBe("Alex");
    expect(jerseyInput().value).toBe("100");
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("EditablePlayerName", () => {
  it("shows the name and number with an edit control", () => {
    render(
      <EditablePlayerName playerId={PLAYER_ID} name="Kim" jerseyNumber={9} />,
    );

    expect(screen.getByRole("heading", { name: "Kim" })).toBeInTheDocument();
    expect(screen.getByText(/9/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("opens a form seeded with the current values and saves them", async () => {
    actions.updatePlayerAction.mockResolvedValue({ status: "success" });
    const { container } = render(
      <EditablePlayerName playerId={PLAYER_ID} name="Kim" jerseyNumber={9} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: playerSetupContent.editAction }),
    );
    expect(nameInput().value).toBe("Kim");
    expect(jerseyInput().value).toBe("9");
    expect(
      container.querySelector<HTMLInputElement>('input[name="playerId"]')
        ?.value,
    ).toBe(PLAYER_ID);

    fireEvent.change(nameInput(), { target: { value: "Kim Beispiel" } });
    fireEvent.click(
      screen.getByRole("button", { name: playerSetupContent.saveAction }),
    );

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    const submitted = actions.updatePlayerAction.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("name")).toBe("Kim Beispiel");
    // A successful save closes the form again.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("discards a cancelled draft and its errors on reopen", async () => {
    actions.updatePlayerAction.mockResolvedValue({
      status: "error",
      fieldErrors: { name: playerSetupContent.errors.nameRequired },
    });
    render(
      <EditablePlayerName
        playerId={PLAYER_ID}
        name="Kim"
        jerseyNumber={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: playerSetupContent.editAction }),
    );
    fireEvent.change(nameInput(), { target: { value: "" } });
    fireEvent.click(
      screen.getByRole("button", { name: playerSetupContent.saveAction }),
    );
    expect(
      await screen.findByText(playerSetupContent.errors.nameRequired),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: playerSetupContent.cancel }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: playerSetupContent.editAction }),
    );

    expect(nameInput().value).toBe("Kim");
    expect(
      screen.queryByText(playerSetupContent.errors.nameRequired),
    ).not.toBeInTheDocument();
  });
});
