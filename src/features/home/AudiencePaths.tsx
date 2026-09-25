import Link from "next/link";

import { homeContent } from "./content";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";
import { Icon } from "@/components/core/Icon";
import { Button } from "@/components/forms/Button";

const { audience, steps } = homeContent;

/**
 * The two ways into the product, side by side: a coach signs in to work, a
 * player opens a share link their coach sent (login-free, so there is no route
 * to send them to here - the card explains the link and jumps to the flow).
 */
export function AudiencePaths() {
  return (
    <section
      aria-labelledby="audience-heading"
      className="flex flex-col gap-[var(--space-4)]"
    >
      <Heading level={2} size="eyebrow" id="audience-heading">
        {audience.heading}
      </Heading>

      <div className="grid gap-[var(--space-3)] sm:grid-cols-2">
        <Card className="flex h-full flex-col gap-[var(--space-3)] p-[var(--space-5)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Icon
              name="user"
              size={18}
              className="text-[color:var(--accent)]"
            />
            <Heading level={3} size="sub">
              {audience.coach.title}
            </Heading>
          </div>
          <p className="flex-1 text-[length:var(--fs-body-sm)] [line-height:var(--lh-body)] text-[color:var(--text-muted)]">
            {audience.coach.description}
          </p>
          <Link href="/login" className="self-start">
            <Button iconRight="chevron-right">{audience.coach.cta}</Button>
          </Link>
        </Card>

        <Card className="flex h-full flex-col gap-[var(--space-3)] p-[var(--space-5)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Icon
              name="link"
              size={18}
              className="text-[color:var(--accent)]"
            />
            <Heading level={3} size="sub">
              {audience.player.title}
            </Heading>
          </div>
          <p className="flex-1 text-[length:var(--fs-body-sm)] [line-height:var(--lh-body)] text-[color:var(--text-muted)]">
            {audience.player.description}
          </p>
          <Link href={`#${steps.anchorId}`} className="self-start">
            <Button variant="secondary" iconRight="chevron-right">
              {audience.player.cta}
            </Button>
          </Link>
        </Card>
      </div>
    </section>
  );
}
