import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import NotFound from "@/app/not-found";
import { notFoundContent } from "@/features/not-found/content";

afterEach(cleanup);

describe("NotFound", () => {
  it("shows the not-found state with a way back home", () => {
    render(<NotFound />);
    expect(screen.getByText(notFoundContent.title)).toBeInTheDocument();
    expect(screen.getByText(notFoundContent.hint)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: notFoundContent.home }),
    ).toHaveAttribute("href", "/");
  });
});
