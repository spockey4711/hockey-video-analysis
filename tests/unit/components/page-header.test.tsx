import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageHeader } from "@/components/core/PageHeader";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders the title as the page's h1 at the page-title rung", () => {
    render(<PageHeader title="Spiele" />);
    const heading = screen.getByRole("heading", { name: "Spiele" });
    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveClass("text-[length:var(--fs-h2)]");
  });

  it("renders the subtitle only when one is given", () => {
    const { rerender } = render(<PageHeader title="Spiele" />);
    expect(screen.queryByText("Alle Spiele")).not.toBeInTheDocument();
    rerender(<PageHeader title="Spiele" subtitle="Alle Spiele" />);
    expect(screen.getByText("Alle Spiele")).toBeInTheDocument();
  });

  it("renders the back link with its chevron only when one is given", () => {
    const { rerender, container } = render(<PageHeader title="Neues Spiel" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(
      <PageHeader
        title="Neues Spiel"
        back={{ href: "/games", label: "Spiele" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Spiele" })).toHaveAttribute(
      "href",
      "/games",
    );
    expect(container.querySelector("a svg")).not.toBeNull();
  });

  it("renders the actions slot only when one is given", () => {
    const { rerender } = render(<PageHeader title="Berichte" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <PageHeader
        title="Berichte"
        actions={<button type="button">CSV</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "CSV" })).toBeInTheDocument();
  });

  it("forwards arbitrary props onto the header landmark", () => {
    render(<PageHeader title="Kader" data-testid="page-header" />);
    expect(screen.getByTestId("page-header").tagName).toBe("HEADER");
  });
});
