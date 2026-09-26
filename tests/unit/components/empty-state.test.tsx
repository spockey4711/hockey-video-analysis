import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "@/components/core/EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the title at the AA-safe secondary rung", () => {
    render(<EmptyState icon="film" title="Noch keine Spiele" />);
    const title = screen.getByText("Noch keine Spiele");
    expect(title).toHaveClass("text-[color:var(--text-secondary)]");
  });

  it("renders the hint only when provided", () => {
    const { rerender } = render(
      <EmptyState icon="film" title="Title" hint="Do the thing" />,
    );
    expect(screen.getByText("Do the thing")).toBeInTheDocument();

    rerender(<EmptyState icon="film" title="Title" />);
    expect(screen.queryByText("Do the thing")).not.toBeInTheDocument();
  });

  it("renders the action slot only when provided", () => {
    render(
      <EmptyState
        icon="film"
        title="Title"
        action={<button type="button">Neues Spiel</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Neues Spiel" }),
    ).toBeInTheDocument();
  });

  it("forwards arbitrary container props and merges className", () => {
    render(
      <EmptyState
        icon="scissors"
        title="Title"
        data-testid="empty"
        className="my-custom"
      />,
    );
    const block = screen.getByTestId("empty");
    expect(block).toHaveClass("my-custom");
    expect(block).toHaveClass("text-center");
  });

  it("scales the title with the size rung", () => {
    const { rerender } = render(<EmptyState icon="tag" title="Title" />);
    expect(screen.getByText("Title")).toHaveClass(
      "text-[length:var(--fs-body)]",
    );

    rerender(<EmptyState icon="tag" title="Title" size="sm" />);
    expect(screen.getByText("Title")).toHaveClass(
      "text-[length:var(--fs-body-sm)]",
      "text-[color:var(--text-secondary)]",
    );

    rerender(<EmptyState icon="tag" title="Title" size="lg" />);
    expect(screen.getByText("Title")).toHaveClass(
      "text-[length:var(--fs-title)]",
      "text-[color:var(--text-primary)]",
    );
  });

  it("tints the glyph chip for the warning tone", () => {
    const { container, rerender } = render(
      <EmptyState icon="alert-triangle" title="Title" />,
    );
    const chip = () => container.querySelector("svg")?.parentElement;
    expect(chip()).toHaveClass("text-[color:var(--text-muted)]");

    rerender(<EmptyState icon="alert-triangle" title="Title" tone="warning" />);
    expect(chip()).toHaveClass("text-[color:var(--warning)]");
  });

  it("frames the block in the inset well only when asked", () => {
    const { rerender } = render(
      <EmptyState icon="tag" title="Title" data-testid="empty" />,
    );
    expect(screen.getByTestId("empty")).not.toHaveClass(
      "bg-[var(--surface-inset)]",
    );

    rerender(<EmptyState icon="tag" title="Title" data-testid="empty" inset />);
    expect(screen.getByTestId("empty")).toHaveClass(
      "bg-[var(--surface-inset)]",
      "border-[color:var(--border-subtle)]",
    );
  });
});
