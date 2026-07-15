import type { ReactNode } from "react";

import { shareContent } from "./content";

import { Icon } from "@/components/core/Icon";

const { shell } = shareContent;

export interface ShareShellProps {
  /** Content heading, e.g. the team or player the link belongs to. */
  title?: string;
  /** Short qualifier under the title, e.g. "Team-weite Clips". */
  subtitle?: string;
  /** The playlist or a state block (loading / empty / expired). */
  children: ReactNode;
}

/**
 * Branded, no-nav chrome for the login-free team and per-player share links.
 * Deliberately carries no coach navigation, sign-out or links back into the
 * app: a recipient reaches this by an unguessable token and must never be able
 * to hop to another surface or another player's clips. Purely presentational -
 * pages set `noindex` via `shareMetadata` and render their `PlaylistPlayer`
 * (or a state block) as `children`.
 */
export function ShareShell({ title, subtitle, children }: ShareShellProps) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-b border-[color:var(--border-subtle)] bg-[var(--surface-raised)]">
        <div className="mx-auto flex w-full max-w-[var(--content-max)] items-center justify-between gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-3)]">
          <span className="text-[length:var(--fs-body)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
            {shell.brand}
          </span>
          <span className="inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-pill)] border border-[color:var(--border-subtle)] bg-[var(--surface)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
            <Icon name="eye-off" size={13} aria-hidden />
            {shell.privateBadge}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-[var(--space-6)] px-[var(--space-6)] py-[var(--space-8)]">
        {(title ?? subtitle) && (
          <div className="flex flex-col gap-[var(--space-1)]">
            {title && (
              <h1 className="text-[length:var(--fs-h2)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </main>

      <footer className="border-t border-[color:var(--border-subtle)] bg-[var(--surface-raised)]">
        <div className="mx-auto w-full max-w-[var(--content-max)] px-[var(--space-6)] py-[var(--space-4)] text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {shell.footerNote}
        </div>
      </footer>
    </div>
  );
}
