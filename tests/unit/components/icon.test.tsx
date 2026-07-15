import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Icon } from "@/components/core/Icon";

afterEach(cleanup);

describe("Icon", () => {
  it("renders the requested Lucide glyph as a decorative svg", () => {
    const { container } = render(<Icon name="film" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveClass("lucide-film");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the size prop to width and height", () => {
    const { container } = render(<Icon name="scissors" size={32} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  it("renders the log-out glyph used by the sign-out control", () => {
    const { container } = render(<Icon name="log-out" />);
    expect(container.querySelector("svg")).toHaveClass("lucide-log-out");
  });

  it("merges a caller className with the base class", () => {
    const { container } = render(<Icon name="tag" className="text-red-500" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("shrink-0");
    expect(svg).toHaveClass("text-red-500");
  });
});
