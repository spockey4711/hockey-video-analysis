import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn<() => string>(),
}));

vi.mock("next/navigation", () => ({ usePathname: mockUsePathname }));

import { SiteFooter } from "@/components/shell/SiteFooter";
import { legalContent } from "@/features/legal";

afterEach(cleanup);

const { links } = legalContent;

describe("SiteFooter", () => {
  it.each(["/", "/login", "/signup", "/games", "/impressum"])(
    "links the legal pages on %s",
    (pathname) => {
      mockUsePathname.mockReturnValue(pathname);
      render(<SiteFooter />);

      expect(
        screen.getByRole("link", { name: links.impressum }),
      ).toHaveAttribute("href", "/impressum");
      expect(screen.getByRole("link", { name: links.privacy })).toHaveAttribute(
        "href",
        "/datenschutz",
      );
    },
  );

  it.each(["/share/team/abc", "/share/player/abc", "/games/7/watch"])(
    "stands aside on %s, which brings its own footer or frame",
    (pathname) => {
      mockUsePathname.mockReturnValue(pathname);
      render(<SiteFooter />);

      expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    },
  );
});
