"use client";

import { useSyncExternalStore } from "react";

import { THEME_PREFERENCES, type ThemePreference } from "./theme";
import {
  setThemePreference,
  subscribeTheme,
  themePreference,
} from "./theme-store";

import type { IconName } from "@/components/core/Icon";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";
// Import the content module directly (not the feature barrel) so this client
// component does not pull in the barrel's server-only auth/db exports.
import { accessContent } from "@/features/access/content";

const { theme } = accessContent.shell;

const ICONS: Record<ThemePreference, IconName> = {
  system: "monitor",
  light: "sun",
  dark: "moon",
};

const OPTIONS = THEME_PREFERENCES.map((value) => ({
  value,
  label: theme.choices[value],
  icon: ICONS[value],
}));

/**
 * The settings page's three-way design choice: follow the OS (`System`), or
 * pin `Hell` or `Dunkel`. It stays in step with the header toggle, which pins
 * the other theme, and with the same choice in another tab. The server
 * snapshot is `system`, the choice with nothing stored.
 */
export function ThemeChoice() {
  const preference = useSyncExternalStore(
    subscribeTheme,
    themePreference.read,
    () => themePreference.fallback,
  );

  return (
    <ChoiceGroup
      label={theme.choiceLabel}
      options={OPTIONS}
      value={preference}
      onChange={setThemePreference}
    />
  );
}
