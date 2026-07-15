import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WatchEmptyState } from "@/components/watch/WatchEmptyState";
import { WatchLayout } from "@/components/watch/WatchLayout";
import { WatchSidebar } from "@/components/watch/WatchSidebar";

afterEach(cleanup);

describe("WatchLayout", () => {
  it("renders the header slot and player region inside a main landmark", () => {
    render(
      <WatchLayout header={<h1>Halbfinale</h1>}>
        <div>player</div>
      </WatchLayout>,
    );

    const main = screen.getByRole("main");
    expect(
      screen.getByRole("heading", { name: "Halbfinale" }),
    ).toBeInTheDocument();
    expect(main).toHaveTextContent("player");
  });
});

describe("WatchSidebar", () => {
  it("stacks its children in order", () => {
    render(
      <WatchSidebar>
        <div>first</div>
        <div>second</div>
      </WatchSidebar>,
    );
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });
});

describe("WatchEmptyState", () => {
  it("shows the supplied message", () => {
    render(<WatchEmptyState message="Kein Videomaterial" />);
    expect(screen.getByText("Kein Videomaterial")).toBeInTheDocument();
  });
});
