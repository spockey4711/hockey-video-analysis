import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WatchHeader } from "@/components/watch/WatchHeader";

afterEach(cleanup);

describe("WatchHeader", () => {
  it("renders the title as the heading", () => {
    render(<WatchHeader title="Halbfinale" />);
    expect(
      screen.getByRole("heading", { name: "Halbfinale" }),
    ).toBeInTheDocument();
  });

  it("joins truthy meta items with a middot and drops falsy ones", () => {
    render(
      <WatchHeader
        title="Halbfinale"
        meta={["gegen HTC", null, "12. Juli 2026"]}
      />,
    );
    expect(screen.getByText("gegen HTC · 12. Juli 2026")).toBeInTheDocument();
  });

  it("omits the meta line when no item is truthy", () => {
    const { container } = render(
      <WatchHeader title="Halbfinale" meta={[null, undefined, false]} />,
    );
    expect(container.querySelector("p")).toBeNull();
  });
});
