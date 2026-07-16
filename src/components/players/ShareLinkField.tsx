"use client";

import { useState } from "react";

import { Button } from "@/components/forms/Button";
// Import the content module directly (not the feature barrel) so this client
// component never pulls the roster's `server-only` query into the client bundle.
import { rosterContent } from "@/features/players/roster/content";

/**
 * A player's secret share link with a copy-to-clipboard button. The visible link
 * uses the app-relative `path` (always valid), while copy writes the absolute
 * `url` when the deploy URL is known so the coach pastes a link that opens
 * anywhere. Purely a display of data the coach-guarded roster already loaded.
 */
export function ShareLinkField({ url, path }: { url: string; path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context); the link stays selectable.
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <span className="text-[length:var(--fs-caption)] [font-weight:var(--fw-medium)] text-[color:var(--text-muted)]">
        {rosterContent.shareLinkLabel}
      </span>
      <div className="flex items-center gap-[var(--space-2)]">
        <a
          href={path}
          rel="nofollow"
          className="min-w-0 flex-1 truncate rounded-[var(--radius-sm)] bg-[var(--surface-inset)] px-[var(--space-2)] py-[var(--space-1)] font-mono text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)] underline-offset-2 hover:underline"
        >
          {path}
        </a>
        <Button type="button" size="sm" variant="ghost" onClick={copy}>
          {copied ? rosterContent.copied : rosterContent.copy}
        </Button>
      </div>
    </div>
  );
}
