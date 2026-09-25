import { homeContent } from "./content";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";

const { steps } = homeContent;

/**
 * The end-to-end pipeline as a numbered sequence. The numbering is meaningful
 * here - a real ordered flow from Aufnehmen to Teilen - not decoration. The
 * section carries the `#ablauf` anchor the player audience card links to.
 */
export function HowItWorks() {
  return (
    <section
      id={steps.anchorId}
      aria-labelledby="ablauf-heading"
      className="flex scroll-mt-[var(--space-16)] flex-col gap-[var(--space-4)]"
    >
      <Heading level={2} size="eyebrow" id="ablauf-heading">
        {steps.heading}
      </Heading>

      <ol className="grid gap-[var(--space-3)] sm:grid-cols-2 lg:grid-cols-4">
        {steps.items.map((step) => (
          <li key={step.n}>
            <Card className="flex h-full flex-col gap-[var(--space-2)] p-[var(--space-4)]">
              <span
                aria-hidden
                className="[font-family:var(--font-mono)] text-[length:var(--fs-h3)] [font-weight:var(--fw-bold)] text-[color:var(--text-brand)]"
              >
                {step.n}
              </span>
              <Heading level={3} size="sub">
                {step.title}
              </Heading>
              <p className="text-[length:var(--fs-body-sm)] [line-height:var(--lh-body)] text-[color:var(--text-muted)]">
                {step.description}
              </p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
