import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TagChip } from "@/components/data/TagChip";

afterEach(cleanup);

describe("TagChip", () => {
  it("falls back to the German label from the tag-type config", () => {
    render(<TagChip type="ecke" data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveTextContent("Ecke kurz");
  });

  it("prefers an explicit label over the config default", () => {
    render(<TagChip type="tor" label="Eigentor" data-testid="chip" />);
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent("Eigentor");
    expect(chip).not.toHaveTextContent("Tor");
  });

  it("uses the tag color token and switches fill between soft and solid", () => {
    const { rerender } = render(<TagChip type="gut" data-testid="chip" />);
    // Soft variant: colored text, no solid fill.
    expect(screen.getByTestId("chip").className).toContain(
      "text-[color:var(--tag-gut)]",
    );
    rerender(<TagChip type="gut" solid data-testid="chip" />);
    expect(screen.getByTestId("chip").className).toContain(
      "bg-[var(--tag-gut)]",
    );
  });

  it("merges a caller className over the defaults", () => {
    render(
      <TagChip type="whistle" className="opacity-50" data-testid="chip" />,
    );
    expect(screen.getByTestId("chip")).toHaveClass("opacity-50");
  });
});
