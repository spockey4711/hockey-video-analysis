import { homeContent } from "./content";

import { Card } from "@/components/core/Card";

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
      <h2
        id="ablauf-heading"
        className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-muted)] uppercase"
      >
        {steps.heading}
      </h2>

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
              <h3 className="[font-family:var(--font-display)] text-[length:var(--fs-title)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
                {step.title}
              </h3>
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
