import Link from "next/link";

import { homeContent } from "./content";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";
import { Icon, type IconName } from "@/components/core/Icon";

const { signedIn } = homeContent;

/**
 * Shortcut tiles for a signed-in coach: the jobs they most often reach for from
 * the landing page (start a game, open the roster, browse collections), one tap
 * away instead of buried under the top-nav sections.
 */
export function QuickActions() {
  return (
    <section
      aria-labelledby="quick-heading"
      className="flex flex-col gap-[var(--space-3)]"
    >
      <Heading level={2} size="eyebrow" id="quick-heading">
        {signedIn.quickHeading}
      </Heading>

      <ul className="grid gap-[var(--space-3)] sm:grid-cols-3">
        {signedIn.quickActions.map((action) => (
          <li key={action.href}>
            <Link
              href={action.href}
              className="block rounded-[var(--radius-lg)]"
            >
              <Card
                interactive
                className="flex items-center gap-[var(--space-3)] p-[var(--space-4)]"
              >
                <Icon
                  name={action.icon as IconName}
                  size={18}
                  className="text-[color:var(--accent)]"
                />
                <span className="[font-weight:var(--fw-medium)] text-[color:var(--text-primary)]">
                  {action.label}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
