import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/forms/Button";

afterEach(cleanup);

describe("Button", () => {
  it("renders a button with its label and a safe default type", () => {
    render(<Button>Speichern</Button>);
    const button = screen.getByRole("button", { name: "Speichern" });
    expect(button).toHaveAttribute("type", "button");
  });

  it("fires onClick when enabled and not when disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders leading and trailing icons alongside the label", () => {
    render(
      <Button iconLeft="scissors" iconRight="chevron-right">
        Clips schneiden
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Clips schneiden" });
    expect(button.querySelector(".lucide-scissors")).not.toBeNull();
    expect(button.querySelector(".lucide-chevron-right")).not.toBeNull();
  });

  it("honours an explicit type override", () => {
    render(<Button type="submit">Absenden</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
