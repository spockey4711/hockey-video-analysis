import type { ReactNode } from "react";

import { Heading } from "@/components/core/Heading";

export interface LegalDocumentProps {
  title: string;
  /** Optional line under the title, e.g. the privacy policy's "Stand". */
  subtitle?: string;
  children: ReactNode;
}

/**
 * Readable single-column frame for the Impressum and the Datenschutzerklärung:
 * a page title over prose sections, narrow enough for long German text.
 */
export function LegalDocument({
  title,
  subtitle,
  children,
}: LegalDocumentProps) {
  return (
    <main className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col gap-[var(--space-8)] px-[var(--space-6)] py-[var(--space-12)]">
      <header className="flex flex-col gap-[var(--space-1)]">
        <Heading level={1}>{title}</Heading>
        {subtitle && (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </main>
  );
}

export interface LegalSectionBlockProps {
  heading: string;
  children: ReactNode;
}

/** One headed section of prose inside a {@link LegalDocument}. */
export function LegalSectionBlock({
  heading,
  children,
}: LegalSectionBlockProps) {
  return (
    <section className="flex flex-col gap-[var(--space-3)] text-[length:var(--fs-body)] leading-[var(--lh-body)] text-[color:var(--text-secondary)]">
      <Heading level={2} size="section">
        {heading}
      </Heading>
      {children}
    </section>
  );
}
