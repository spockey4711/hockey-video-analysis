import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/components/shell/theme";
import { accessContent } from "@/features/access";

const { theme } = accessContent.shell;

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("defaults to the dark theme and offers the switch to light", () => {
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: theme.toLight });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to light, persisting the choice and updating the document", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: theme.toLight }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    const button = screen.getByRole("button", { name: theme.toDark });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("reads the theme already applied to the document on mount", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: theme.toDark }),
    ).toBeInTheDocument();
  });

  it("toggles back to dark on a second click", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: theme.toLight }));
    fireEvent.click(screen.getByRole("button", { name: theme.toDark }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
