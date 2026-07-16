import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Kbd } from "@/components/data/Kbd";

afterEach(cleanup);

describe("Kbd", () => {
  it("renders a kbd element with its key label", () => {
    render(<Kbd data-testid="key">G</Kbd>);
    const key = screen.getByTestId("key");
    expect(key.tagName).toBe("KBD");
    expect(key).toHaveTextContent("G");
  });

  it("applies size classes and merges a caller className", () => {
    render(
      <Kbd size="sm" className="tracking-wide" data-testid="key">
        ?
      </Kbd>,
    );
    const key = screen.getByTestId("key");
    expect(key.className).toContain("h-[var(--space-5)]");
    expect(key).toHaveClass("tracking-wide");
  });
});
