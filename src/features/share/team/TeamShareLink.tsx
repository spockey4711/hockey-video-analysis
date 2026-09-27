import Link from "next/link";

import { RegenerateTeamLinkForm } from "./RegenerateTeamLinkForm";
import { teamShareContent } from "./content";
import { teamSharePath, teamShareUrl } from "./share-link";
import { getTeamShareToken } from "./token";

import { Card } from "@/components/core/Card";
import { PanelHeader } from "@/components/core/PanelHeader";
// Import the field directly (not the players barrel) so this surface never pulls
// the roster's server-only queries in through the barrel.
import { ShareLinkField } from "@/components/players/ShareLinkField";

const { coachLink } = teamShareContent;

const MUTED_TEXT =
  "text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]";

/**
 * The copyable team link, or why there is none. The surfaces below read the
 * token server-side via {@link getTeamShareToken} and this passes only the
 * assembled URL and path down to the client {@link ShareLinkField} - the raw
 * token never enters the client bundle beyond the link the coach is meant to
 * copy.
 */
function TeamLinkField({
  token,
  baseUrl,
  disabled,
  label,
}: {
  token: string | undefined;
  baseUrl?: string;
  disabled: string;
  /** The field label; the roster card keeps the field's default. */
  label?: string;
}) {
  return token ? (
    <ShareLinkField
      url={teamShareUrl(token, baseUrl)}
      path={teamSharePath(token)}
      label={label}
    />
  ) : (
    <p className={MUTED_TEXT}>{disabled}</p>
  );
}

/**
 * The team link on the roster (P2-4), next to the per-player links: copy only.
 * Creating or replacing it lives under Einstellungen > Teilen, which the card
 * points to.
 */
export async function TeamShareLink({ baseUrl }: { baseUrl?: string }) {
  const token = await getTeamShareToken();
  return (
    <Card className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]">
      <PanelHeader
        size="sub"
        title={coachLink.title}
        hint={coachLink.description}
      />
      <TeamLinkField
        token={token}
        baseUrl={baseUrl}
        disabled={coachLink.disabled}
      />
      <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
        <Link
          href="/settings#teilen"
          className="underline underline-offset-2 hover:text-[color:var(--text-primary)]"
        >
          {coachLink.manageHint}
        </Link>
      </p>
    </Card>
  );
}

/**
 * The roster's team link card while the page loads: the real header over a
 * pulsing field, so the frame stays put without reading the token.
 */
export function TeamShareLinkSkeleton() {
  return (
    <Card className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]">
      <PanelHeader
        size="sub"
        title={coachLink.title}
        hint={coachLink.description}
      />
      <span
        role="status"
        aria-label={coachLink.loading}
        className="h-[var(--space-8)] w-full animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-inset)]"
      />
    </Card>
  );
}

/**
 * The team link under Einstellungen > Teilen: the copyable link and the
 * control that creates it, or replaces it and so revokes the old one.
 */
export async function TeamShareSettings({ baseUrl }: { baseUrl?: string }) {
  const token = await getTeamShareToken();
  return (
    <>
      <TeamLinkField
        token={token}
        baseUrl={baseUrl}
        disabled={teamShareContent.settings.disabled}
        label={coachLink.fieldLabel}
      />
      <RegenerateTeamLinkForm hasLink={token !== undefined} />
    </>
  );
}
