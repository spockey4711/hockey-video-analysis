"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_THEME,
  isTheme,
  nextTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  type Theme,
} from "./theme";

import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
// Import the content module directly (not the feature barrel) so this client
// component does not pull in the barrel's server-only auth/db exports.
import { accessContent } from "@/features/access/content";

const { shell } = accessContent;

/**
 * The document root is the single source of truth for the active theme: the
 * no-flash `ThemeScript` writes it before hydration and {@link setTheme} rewrites
 * it on toggle. This is a minimal external store over that attribute - reads go
 * straight to the DOM, and the toggle is the only writer, so it notifies
 * subscribers synchronously rather than observing the DOM.
 */
const listeners = new Set<() => void>();

function readActiveTheme(): Theme {
  const attr = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isTheme(attr) ? attr : DEFAULT_THEME;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function setTheme(next: Theme): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* Private-mode or blocked storage: the toggle still works for the session. */
  }
  listeners.forEach((listener) => listener());
}

export interface ThemeToggleProps {
  /**
   * Render a text button that spells out the switch (the settings page) instead
   * of the compact icon button the header uses.
   */
  labelled?: boolean;
}

/**
 * Coach-facing light/dark toggle for the app header and the settings page.
 * Subscribes to the theme store above via {@link useSyncExternalStore}; its
 * server snapshot is {@link DEFAULT_THEME}, matching the SSR markup, so
 * hydration never mismatches, while the client snapshot reflects whatever theme
 * is actually live.
 */
export function ThemeToggle({ labelled = false }: ThemeToggleProps) {
  const current = useSyncExternalStore(
    subscribe,
    readActiveTheme,
    () => DEFAULT_THEME,
  );

  const goingLight = current === "dark";
  const icon = goingLight ? "sun" : "moon";
  const label = goingLight ? shell.theme.toLight : shell.theme.toDark;
  const toggle = () => setTheme(nextTheme(current));

  if (labelled) {
    return (
      <Button variant="secondary" size="sm" iconLeft={icon} onClick={toggle}>
        {label}
      </Button>
    );
  }

  return (
    <IconButton
      size="sm"
      name={icon}
      label={label}
      active={current === "light"}
      onClick={toggle}
    />
  );
}
