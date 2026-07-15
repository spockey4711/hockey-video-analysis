import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/data/StatusBadge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("renders the default German label for a status", () => {
    render(<StatusBadge status="ready" data-testid="badge" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Bereit");
  });

  it("lets the caller override the label", () => {
    render(
      <StatusBadge status="failed" label="Abgebrochen" data-testid="badge" />,
    );
    expect(screen.getByTestId("badge")).toHaveTextContent("Abgebrochen");
  });

  it("pulses the dot only while processing", () => {
    const { rerender } = render(
      <StatusBadge status="pending" data-testid="badge" />,
    );
    expect(
      screen.getByTestId("badge").querySelector(".animate-pulse"),
    ).toBeNull();
    rerender(<StatusBadge status="processing" data-testid="badge" />);
    expect(
      screen.getByTestId("badge").querySelector(".animate-pulse"),
    ).not.toBeNull();
  });

  it("colors the dot from the matching status token", () => {
    render(<StatusBadge status="processing" data-testid="badge" />);
    const dot = screen.getByTestId("badge").firstElementChild;
    expect(dot?.className).toContain("bg-[var(--status-processing)]");
  });
});
