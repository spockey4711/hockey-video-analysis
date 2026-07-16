import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn<() => string>(),
}));

vi.mock("next/navigation", () => ({ usePathname: mockUsePathname }));

import { CoachHeader } from "@/components/shell/CoachHeader";

afterEach(cleanup);

const HEADER = "coach-header";

describe("CoachHeader", () => {
  it("shows the header on a normal coach route", () => {
    mockUsePathname.mockReturnValue("/games");
    render(
      <CoachHeader>
        <div>{HEADER}</div>
      </CoachHeader>,
    );

    expect(screen.getByText(HEADER)).toBeInTheDocument();
  });

  it("hides the header on the immersive watch route", () => {
    // The bug this guards: reached by client navigation, where the root-layout
    // shell never re-renders, the bar used to linger over the 100dvh HUD and
    // push the page into a one-header-tall scroll.
    mockUsePathname.mockReturnValue("/games/7/watch");
    render(
      <CoachHeader>
        <div>{HEADER}</div>
      </CoachHeader>,
    );

    expect(screen.queryByText(HEADER)).not.toBeInTheDocument();
  });
});
