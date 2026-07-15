import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IconButton } from "@/components/forms/IconButton";

afterEach(cleanup);

describe("IconButton", () => {
  it("exposes the label as accessible name and tooltip", () => {
    render(<IconButton name="play" label="Abspielen" />);
    const button = screen.getByRole("button", { name: "Abspielen" });
    expect(button).toHaveAttribute("title", "Abspielen");
    expect(button.querySelector(".lucide-play")).not.toBeNull();
  });

  it("reflects the active state via aria-pressed", () => {
    const { rerender } = render(<IconButton name="pause" label="Pause" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    rerender(<IconButton name="pause" label="Pause" active />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<IconButton name="scissors" label="Schneiden" onClick={onClick} />);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
