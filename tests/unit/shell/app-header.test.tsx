import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/games" }));

import { AppHeader } from "@/components/shell/AppHeader";
import { PRIMARY_NAV } from "@/components/shell/nav-config";
import { accessContent } from "@/features/access";

afterEach(cleanup);

const { shell } = accessContent;

/**
 * jsdom has no layout, so these pin the wrapping contract that keeps the bar
 * from overflowing a phone-width viewport (the brand, nav and actions together
 * need about 760px): the row wraps, the nav drops to its own full-width row
 * below `lg`, its links wrap, and the sign-out label collapses to the icon.
 */
describe("AppHeader", () => {
  it("wraps the bar instead of overflowing on narrow screens", () => {
    render(<AppHeader coachName="Coach" />);

    const nav = screen.getByRole("navigation", { name: "Hauptnavigation" });
    const row = nav.parentElement!;
    expect(row).toHaveClass("flex-wrap");
    expect(nav).toHaveClass(
      "order-last",
      "w-full",
      "lg:order-none",
      "lg:w-auto",
    );
    expect(within(nav).getByRole("list")).toHaveClass("flex-wrap");
  });

  it("keeps every section link and header action reachable", () => {
    render(<AppHeader coachName="Coach" />);

    const nav = screen.getByRole("navigation", { name: "Hauptnavigation" });
    for (const item of PRIMARY_NAV) {
      expect(
        within(nav).getByRole("link", { name: item.label }),
      ).toHaveAttribute("href", item.href);
    }
    expect(screen.getByRole("link", { name: shell.brand })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("button", { name: shell.signOut })).toBeVisible();
  });
});
