import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LegalLinks, legalContent } from "@/features/legal";

afterEach(cleanup);

const { links } = legalContent;

describe("LegalLinks", () => {
  it("links the Impressum and the Datenschutzerklärung", () => {
    render(<LegalLinks />);

    expect(
      screen.getByRole("navigation", { name: links.navLabel }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: links.impressum })).toHaveAttribute(
      "href",
      "/impressum",
    );
    expect(screen.getByRole("link", { name: links.privacy })).toHaveAttribute(
      "href",
      "/datenschutz",
    );
  });
});
