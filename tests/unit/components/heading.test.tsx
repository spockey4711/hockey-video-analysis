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

  it("gives the section rung the h3 step with title tracking", () => {
    render(
      <Heading data-testid="h" size="section">
        x
      </Heading>,
    );
    const heading = screen.getByTestId("h");
    expect(heading).toHaveClass("text-[length:var(--fs-h3)]");
    expect(heading).toHaveClass("tracking-[var(--ls-tight)]");
  });

  it("renders the eyebrow rung as a small-caps label in the display face", () => {
    render(
      <Heading data-testid="h" level={3} size="eyebrow">
        Tags
      </Heading>,
    );
    const heading = screen.getByTestId("h");
    expect(heading.tagName).toBe("H3");
    expect(heading).toHaveClass("font-[family-name:var(--font-display)]");
    expect(heading).toHaveClass("text-[length:var(--fs-caption)]");
    expect(heading).toHaveClass("tracking-[var(--ls-caps)]");
    expect(heading).toHaveClass("text-[color:var(--text-secondary)]");
    expect(heading).toHaveClass("uppercase");
    // The eyebrow swaps the title tracking and colour rather than stacking them.
    expect(heading).not.toHaveClass("tracking-[var(--ls-tight)]");
    expect(heading).not.toHaveClass("text-[color:var(--text-primary)]");
  });

  it("lets a caller override the heading line-height", () => {
    render(
      <Heading data-testid="h" className="[line-height:var(--lh-tight)]">
        x
      </Heading>,
    );
    const heading = screen.getByTestId("h");
    expect(heading).toHaveClass("[line-height:var(--lh-tight)]");
    expect(heading).not.toHaveClass("[line-height:var(--lh-heading)]");
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
