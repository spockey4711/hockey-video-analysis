import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeColorScheme } from "../shell/fake-color-scheme";

import { ThemeChoice } from "@/components/shell/ThemeChoice";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/components/shell/theme";
import { accessContent } from "@/features/access";
import {
  PresentationScaleChoice,
  presentationContent,
} from "@/features/share/presentation";
import { PRESENTATION_SCALE_STORAGE_KEY } from "@/features/share/presentation/presentation-scale";

const { theme } = accessContent.shell;
const { scale } = presentationContent;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

function themeGroup() {
  return screen.getByRole("group", { name: theme.choiceLabel });
}

describe("ThemeChoice", () => {
  it("is a labelled radio group with system chosen when nothing is stored", () => {
    render(<ThemeChoice />);

    expect(themeGroup()).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(
      screen.getByRole("radio", { name: theme.choices.system }),
    ).toBeChecked();
  });

  it("pins light and dark, and system clears the stored choice", () => {
    const scheme = fakeColorScheme(false);
    render(<ThemeChoice />);

    fireEvent.click(screen.getByRole("radio", { name: theme.choices.light }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("radio", { name: theme.choices.dark }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("radio", { name: theme.choices.system }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => scheme.setLight(true));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("shows the header toggle's flip as a pinned choice", () => {
    render(
      <>
        <ThemeToggle />
        <ThemeChoice />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: theme.toLight }));

    expect(
      screen.getByRole("radio", { name: theme.choices.light }),
    ).toBeChecked();
  });

  it("picks up a choice made in another tab", () => {
    render(<ThemeChoice />);

    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      window.dispatchEvent(
        new StorageEvent("storage", { key: THEME_STORAGE_KEY }),
      );
    });

    expect(
      screen.getByRole("radio", { name: theme.choices.light }),
    ).toBeChecked();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

describe("PresentationScaleChoice", () => {
  it("offers Normal, Groß and Sehr groß with Normal chosen by default", () => {
    render(<PresentationScaleChoice />);

    expect(
      screen.getByRole("group", { name: scale.label }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: scale.choices.normal }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: scale.choices.large }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("radio", { name: scale.choices["x-large"] }),
    ).not.toBeChecked();
  });

  it("stores the chosen size for this device", () => {
    render(<PresentationScaleChoice />);

    fireEvent.click(screen.getByRole("radio", { name: scale.choices.large }));

    expect(localStorage.getItem(PRESENTATION_SCALE_STORAGE_KEY)).toBe("large");
    expect(
      screen.getByRole("radio", { name: scale.choices.large }),
    ).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: scale.choices.normal }));
    expect(localStorage.getItem(PRESENTATION_SCALE_STORAGE_KEY)).toBeNull();
  });

  it("restores a stored size", () => {
    localStorage.setItem(PRESENTATION_SCALE_STORAGE_KEY, "x-large");
    render(<PresentationScaleChoice />);

    expect(
      screen.getByRole("radio", { name: scale.choices["x-large"] }),
    ).toBeChecked();
  });
});
