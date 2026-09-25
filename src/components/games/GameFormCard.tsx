import type { ReactNode } from "react";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";
import { gamesContent } from "@/features/games";

const { create } = gamesContent;

/**
 * Accent-topped panel that frames the create-game form: the title and subtitle
 * header above the form fields passed as children. Presentational only - the
 * form (and its logic) stay in the games feature; this just supplies the DS
 * surface and heading.
 */
export function GameFormCard({ children }: { children: ReactNode }) {
  return (
    <Card accent className="p-[var(--space-8)]">
      <header className="mb-[var(--space-6)] flex flex-col gap-[var(--space-2)]">
        <Heading level={1} size="sub">
          {create.title}
        </Heading>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {create.subtitle}
        </p>
      </header>
      {children}
    </Card>
  );
}
