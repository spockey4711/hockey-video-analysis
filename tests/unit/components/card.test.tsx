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

  it("renders as a different element when asked", () => {
    render(
      <Card as="section" aria-label="Panel" data-testid="card">
        x
      </Card>,
    );
    expect(screen.getByTestId("card").tagName).toBe("SECTION");
  });

  it("swaps the resting surface for the raised panel treatment", () => {
    const { rerender } = render(<Card data-testid="card">x</Card>);
    const resting = screen.getByTestId("card");
    expect(resting).toHaveClass("bg-[var(--surface)]");
    expect(resting).toHaveClass("shadow-[var(--shadow-sm)]");

    rerender(
      <Card data-testid="card" panel>
        x
      </Card>,
    );
    const card = screen.getByTestId("card");
    // The panel variant overrides surface, radius, border and elevation.
    expect(card).toHaveClass("bg-[var(--surface-raised)]");
    expect(card).toHaveClass("rounded-[var(--radius-md)]");
    expect(card).toHaveClass("shadow-[var(--shadow-md)]");
    expect(card.className).not.toContain("bg-[var(--surface)]");
    expect(card.className).not.toContain("shadow-[var(--shadow-sm)]");
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
