import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PanelHeader } from "@/components/core/PanelHeader";

afterEach(cleanup);

describe("PanelHeader", () => {
  it("renders the title as an h2 in the HUD caption treatment", () => {
    render(<PanelHeader title="Clips" />);
    const heading = screen.getByRole("heading", { name: "Clips" });
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveClass("text-[length:var(--fs-caption)]");
    expect(heading).toHaveClass("tracking-[var(--ls-caps)]");
    expect(heading).toHaveClass("uppercase");
  });

  it("renders the hint only when one is given", () => {
    const { rerender } = render(<PanelHeader title="Clips" />);
    expect(screen.queryByText("Cut a tag into a clip")).not.toBeInTheDocument();
    rerender(<PanelHeader title="Clips" hint="Cut a tag into a clip" />);
    expect(screen.getByText("Cut a tag into a clip")).toBeInTheDocument();
  });

  it("renders the action slot only when one is given", () => {
    const { rerender } = render(<PanelHeader title="Markers" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <PanelHeader
        title="Markers"
        action={<button type="button">Next</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("renders the requested heading level for the document outline", () => {
    render(<PanelHeader title="Markers" level={3} />);
    expect(screen.getByRole("heading", { name: "Markers" }).tagName).toBe("H3");
  });

  it("forwards arbitrary props onto the wrapper", () => {
    render(
      <PanelHeader title="Clips" data-testid="header" id="clips-header" />,
    );
    const header = screen.getByTestId("header");
    expect(header).toHaveAttribute("id", "clips-header");
  });
});
