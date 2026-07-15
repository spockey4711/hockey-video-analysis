import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Heading } from "@/components/core/Heading";

afterEach(cleanup);

describe("Heading", () => {
  it("renders the semantic level and forwards arbitrary props", () => {
    render(
      <Heading level={1} data-testid="h" id="page-title">
        Games
      </Heading>,
    );
    const heading = screen.getByTestId("h");
    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveTextContent("Games");
    expect(heading).toHaveAttribute("id", "page-title");
  });

  it("defaults to an h2 at the shared page-title size", () => {
    render(<Heading data-testid="h">Title</Heading>);
    const heading = screen.getByTestId("h");
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveClass("text-[length:var(--fs-h2)]");
  });

  it("applies the display face and heading line-height to every heading", () => {
    render(<Heading data-testid="h">Title</Heading>);
    const heading = screen.getByTestId("h");
    expect(heading).toHaveClass("font-[family-name:var(--font-display)]");
    expect(heading).toHaveClass("tracking-[var(--ls-tight)]");
    expect(heading).toHaveClass("[line-height:var(--lh-heading)]");
  });

  it("maps each size to its type-scale step", () => {
    const { rerender } = render(
      <Heading data-testid="h" size="display">
        x
      </Heading>,
    );
    expect(screen.getByTestId("h")).toHaveClass(
      "text-[length:var(--fs-display)]",
    );
    rerender(
      <Heading data-testid="h" size="sub">
        x
      </Heading>,
    );
    expect(screen.getByTestId("h")).toHaveClass(
      "text-[length:var(--fs-title)]",
    );
  });

  it("lets a caller className override the size default", () => {
    render(
      <Heading data-testid="h" className="text-[length:var(--fs-display)]">
        x
      </Heading>,
    );
    const heading = screen.getByTestId("h");
    // tailwind-merge keeps the caller size, drops the default one.
    expect(heading).toHaveClass("text-[length:var(--fs-display)]");
    expect(heading).not.toHaveClass("text-[length:var(--fs-h2)]");
  });
});
