import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeColorScheme } from "./fake-color-scheme";

import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/components/shell/theme";
import { accessContent } from "@/features/access";

const { theme } = accessContent.shell;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it("keeps two toggles in sync", () => {
    render(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    );

    const [first] = screen.getAllByRole("button", { name: theme.toLight });
    if (!first) throw new Error("expected two toggles");
    fireEvent.click(first);

    expect(screen.getAllByRole("button", { name: theme.toDark })).toHaveLength(
      2,
    );
  });

  it("toggles back to dark on a second click", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: theme.toLight }));
    fireEvent.click(screen.getByRole("button", { name: theme.toDark }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("follows the OS while nothing is pinned", () => {
    const scheme = fakeColorScheme(false);
    render(<ThemeToggle />);

    act(() => scheme.setLight(true));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(
      screen.getByRole("button", { name: theme.toDark }),
    ).toBeInTheDocument();
  });

  it("pins the flipped theme, so the OS no longer moves it", () => {
    const scheme = fakeColorScheme(true);
    document.documentElement.setAttribute("data-theme", "light");
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: theme.toDark }));
    act(() => scheme.setLight(true));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
