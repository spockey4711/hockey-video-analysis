import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Card } from "@/components/core/Card";

afterEach(cleanup);

describe("Card", () => {
  it("renders children and forwards arbitrary props", () => {
    render(
      <Card data-testid="card" role="group">
        Panel body
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveTextContent("Panel body");
    expect(card).toHaveAttribute("role", "group");
  });

  it("adds interactive affordances only when requested", () => {
    const { rerender } = render(<Card data-testid="card">x</Card>);
    expect(screen.getByTestId("card")).not.toHaveClass("cursor-pointer");
    rerender(
      <Card data-testid="card" interactive>
        x
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveClass("cursor-pointer");
  });

  it("merges a caller className over the defaults", () => {
    render(
      <Card data-testid="card" className="bg-[var(--surface-raised)]">
        x
      </Card>,
    );
    const card = screen.getByTestId("card");
    // tailwind-merge keeps the caller background, drops the default one.
    expect(card.className).toContain("bg-[var(--surface-raised)]");
    expect(card.className).not.toContain("bg-[var(--surface)]");
  });

  it("supports click handlers on interactive cards", () => {
    const onClick = vi.fn();
    render(
      <Card data-testid="card" interactive onClick={onClick}>
        x
      </Card>,
    );
    screen.getByTestId("card").click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
