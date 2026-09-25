import type { ReactNode } from "react";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";

/**
 * One labelled panel on the settings page: a sub-heading, an optional
 * description and the section's controls, wrapped in a `Card` landmark. Keeps
 * the page's sections visually and semantically consistent.
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card
      as="section"
      aria-label={title}
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-6)]"
    >
      <PanelHeader size="sub" title={title} hint={description} />
      {children}
    </Card>
  );
}
