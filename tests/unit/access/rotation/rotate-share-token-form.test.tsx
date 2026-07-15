import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the server action module so importing the form does not pull the auth/db
// chain into the test, and stub the router the form refreshes on success.
const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Only the action needs stubbing (it pulls the auth/db chain); the initial state
// lives in the pure `./state` module, which is safe to import for real.
vi.mock("@/features/access/rotation/actions", () => ({
  rotateShareTokenAction: vi.fn(async () => ({ status: "idle" as const })),
}));

import { RotateShareTokenForm } from "@/features/access/rotation/RotateShareTokenForm";
import { rotationContent } from "@/features/access/rotation/content";

afterEach(cleanup);

const PLAYER_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("RotateShareTokenForm", () => {
  it("gates rotation behind a confirm step rather than firing on the first click", () => {
    render(<RotateShareTokenForm playerId={PLAYER_ID} />);

    // Only the trigger is shown up front; no warning and no confirm button.
    expect(
      screen.getByRole("button", { name: rotationContent.action }),
    ).toBeInTheDocument();
    expect(screen.queryByText(rotationContent.confirm)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: rotationContent.action }),
    );

    // The warning and the real submit button appear only after the first click.
    expect(screen.getByText(rotationContent.confirm)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: rotationContent.confirmYes }),
    ).toBeInTheDocument();
  });

  it("returns to the trigger when the coach cancels", () => {
    render(<RotateShareTokenForm playerId={PLAYER_ID} />);

    fireEvent.click(
      screen.getByRole("button", { name: rotationContent.action }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: rotationContent.cancel }),
    );

    expect(
      screen.getByRole("button", { name: rotationContent.action }),
    ).toBeInTheDocument();
    expect(screen.queryByText(rotationContent.confirm)).not.toBeInTheDocument();
  });

  it("carries the player id in a hidden field for the action", () => {
    const { container } = render(<RotateShareTokenForm playerId={PLAYER_ID} />);

    const hidden = container.querySelector<HTMLInputElement>(
      'input[name="playerId"]',
    );
    expect(hidden?.value).toBe(PLAYER_ID);
  });
});
