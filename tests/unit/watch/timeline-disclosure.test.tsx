import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TimelineDisclosure } from "@/components/watch";

afterEach(cleanup);

function open(): HTMLDetailsElement {
  const summary = screen.getByText("Quarters");
  const details = summary.closest("details") as HTMLDetailsElement;
  fireEvent.click(summary);
  expect(details.open).toBe(true);
  return details;
}

describe("TimelineDisclosure", () => {
  it("closes an open panel on a pointer press outside it", () => {
    render(
      <TimelineDisclosure icon="flag" label="Quarters">
        <button>Set start</button>
      </TimelineDisclosure>,
    );

    const details = open();
    fireEvent.pointerDown(document.body);

    expect(details.open).toBe(false);
  });

  it("keeps the panel open when the press lands inside it", () => {
    render(
      <TimelineDisclosure icon="flag" label="Quarters">
        <button>Set start</button>
      </TimelineDisclosure>,
    );

    const details = open();
    fireEvent.pointerDown(screen.getByText("Set start"));

    expect(details.open).toBe(true);
  });

  it("closes an open panel on Escape", () => {
    render(
      <TimelineDisclosure icon="flag" label="Quarters">
        <button>Set start</button>
      </TimelineDisclosure>,
    );

    const details = open();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(details.open).toBe(false);
  });

  it("keeps the children mounted after being dismissed", () => {
    render(
      <TimelineDisclosure icon="flag" label="Quarters">
        <button>Set start</button>
      </TimelineDisclosure>,
    );

    open();
    fireEvent.pointerDown(document.body);

    // The panel is collapsed but its children stay mounted (hotkeys stay live).
    expect(screen.getByText("Set start")).toBeTruthy();
  });
});
