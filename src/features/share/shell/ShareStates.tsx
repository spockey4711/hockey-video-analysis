import type { ReactNode } from "react";

import { shareContent } from "./content";

import { Icon, type IconName } from "@/components/core/Icon";

type Tone = "neutral" | "warning";

const TONE_ICON: Record<Tone, string> = {
  neutral: "text-[color:var(--text-muted)]",
  warning: "text-[color:var(--warning)]",
};

interface ShareMessageProps {
  icon: IconName;
  tone?: Tone;
  title: string;
  body?: ReactNode;
}

/**
 * Centered, iconed message block for the share surface's empty and expired
 * states. Rendered as `ShareShell` children; keeps the same card footprint as a
 * playlist so the frame does not jump between states.
 */
export function ShareMessage({
  icon,
  tone = "neutral",
  title,
  body,
}: ShareMessageProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface)] px-[var(--space-6)] py-[var(--space-12)] text-center"
    >
      <Icon name={icon} size={28} aria-hidden className={TONE_ICON[tone]} />
      <div className="flex flex-col gap-[var(--space-1)]">
        <p className="text-[length:var(--fs-title)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
          {title}
        </p>
        {body && (
          <p className="mx-auto max-w-[36rem] text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {body}
          </p>
        )}
      </div>
    </div>
  );
}

/** Nothing has been shared on this link yet. */
export function ShareEmptyState() {
  return (
    <ShareMessage
      icon="eye-off"
      title={shareContent.empty.title}
      body={shareContent.empty.body}
    />
  );
}

/** The token no longer resolves - expired or revoked. */
export function ShareExpiredState() {
  return (
    <ShareMessage
      icon="alert-triangle"
      tone="warning"
      title={shareContent.expired.title}
      body={shareContent.expired.body}
    />
  );
}

/**
 * Loading placeholder for the playlist. Server-rendered as a `loading.tsx`
 * fallback or while the client player boots; pure CSS spinner, no interactivity.
 */
export function ShareLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--surface)] px-[var(--space-6)] py-[var(--space-12)] text-center"
    >
      <Icon
        name="loader"
        size={26}
        aria-hidden
        className="animate-spin text-[color:var(--accent)]"
      />
      <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        {shareContent.loading.title}
      </p>
    </div>
  );
}
