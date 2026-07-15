import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TagChip } from "@/components/data/TagChip";

afterEach(cleanup);

describe("TagChip", () => {
  it("falls back to the German label from the P1-3 tag-type config", () => {
    render(<TagChip type="corner_short" data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveTextContent("Ecke kurz");
  });

  it("labels the whistle suggestion chip locally (no P1-3 entry)", () => {
    render(<TagChip type="whistle" data-testid="chip" />);
    expect(screen.getByTestId("chip")).toHaveTextContent("Vorschlag");
  });

  it("prefers an explicit label over the config default", () => {
    render(<TagChip type="goal" label="Eigentor" data-testid="chip" />);
    const chip = screen.getByTestId("chip");
    expect(chip).toHaveTextContent("Eigentor");
    expect(chip).not.toHaveTextContent("Tor");
  });

  it("uses the tag color token and switches fill between soft and solid", () => {
    const { rerender } = render(
      <TagChip type="action_good" data-testid="chip" />,
    );
    // Soft variant: colored text, no solid fill.
    expect(screen.getByTestId("chip").className).toContain(
      "text-[color:var(--tag-gut)]",
    );
    rerender(<TagChip type="action_good" solid data-testid="chip" />);
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
