import type { ReactNode } from "react";

import { shareContent } from "./content";

import { Card } from "@/components/core/Card";
import { EmptyState, type EmptyStateTone } from "@/components/core/EmptyState";
import { Icon, type IconName } from "@/components/core/Icon";

interface ShareMessageProps {
  icon: IconName;
  tone?: EmptyStateTone;
  title: string;
  body?: ReactNode;
}

/**
 * The share surface's empty and expired states: the shared page-level
 * `EmptyState` in a `Card`. Rendered as `ShareShell` children; keeps the same
 * card footprint as a playlist so the frame does not jump between states.
 */
export function ShareMessage({
  icon,
  tone = "neutral",
  title,
  body,
}: ShareMessageProps) {
  return (
    <Card role="status" className="px-[var(--space-6)] py-[var(--space-12)]">
      <EmptyState icon={icon} tone={tone} size="lg" title={title} hint={body} />
    </Card>
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
    <Card
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-[var(--space-3)] px-[var(--space-6)] py-[var(--space-12)] text-center"
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
    </Card>
  );
}
