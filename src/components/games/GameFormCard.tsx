import type { ReactNode } from "react";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
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
      <PanelHeader
        level={1}
        size="sub"
        title={create.title}
        hint={create.subtitle}
        className="mb-[var(--space-6)]"
      />
      {children}
    </Card>
  );
}
