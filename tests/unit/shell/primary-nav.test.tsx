import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn<() => string>(),
}));

vi.mock("next/navigation", () => ({ usePathname: mockUsePathname }));

import { PrimaryNav } from "@/components/shell/PrimaryNav";
import { PRIMARY_NAV } from "@/components/shell/nav-config";

afterEach(cleanup);

const games = PRIMARY_NAV.find((item) => item.href === "/games")!;

describe("PrimaryNav", () => {
  it("marks the active section with aria-current on its own route", () => {
    mockUsePathname.mockReturnValue("/games/7/watch");
    render(<PrimaryNav />);

    const link = screen.getByRole("link", { name: games.label });
    expect(link).toHaveAttribute("href", "/games");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("leaves a nav link unmarked away from its section", () => {
    mockUsePathname.mockReturnValue("/");
    render(<PrimaryNav />);

    const link = screen.getByRole("link", { name: games.label });
    expect(link).not.toHaveAttribute("aria-current");
  });
});
