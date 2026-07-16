import type { ReactNode } from "react";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";

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
      panel
      aria-label={title}
      className="flex flex-col gap-[var(--space-4)] p-[var(--space-6)]"
    >
      <header className="flex flex-col gap-[var(--space-1)]">
        <Heading level={2} size="sub">
          {title}
        </Heading>
        {description && (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {description}
          </p>
        )}
      </header>
      {children}
    </Card>
  );
}
