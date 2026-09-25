import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { accessContent } from "@/features/access";
import { SignOutForm } from "@/features/access";

afterEach(cleanup);

const { shell } = accessContent;

describe("SignOutForm", () => {
  it("renders a submit button that posts the sign-out form", () => {
    render(<SignOutForm />);

    const button = screen.getByRole("button", { name: shell.signOut });
    expect(button).toHaveAttribute("type", "submit");

    // The button must live inside a form so sign-out is a submit driven by the
    // form's `logoutAction`, not an ad-hoc onClick handler.
    expect(button.closest("form")).not.toBeNull();
  });

  it("takes a bordered style for panels without changing what it submits", () => {
    render(<SignOutForm variant="secondary" />);

    const button = screen.getByRole("button", { name: shell.signOut });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.className).toContain("border");
  });

  it("can collapse its label to the icon on narrow screens but keeps its name", () => {
    render(<SignOutForm compact />);

    const button = screen.getByRole("button", { name: shell.signOut });
    expect(screen.getByText(shell.signOut)).toHaveClass("max-sm:sr-only");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("shows its label at every width by default", () => {
    render(<SignOutForm />);

    expect(screen.getByText(shell.signOut)).not.toHaveClass("max-sm:sr-only");
  });
});
