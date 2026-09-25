import { teamShareContent } from "./content";
import { teamSharePath, teamShareUrl } from "./share-link";
import { getTeamShareToken } from "./token";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";
// Import the field directly (not the players barrel) so this surface never pulls
// the roster's server-only queries in through the barrel.
import { ShareLinkField } from "@/components/players/ShareLinkField";

/**
 * Coach-only surface for the single team share link (P2-4). Per-player links are
 * copyable on the roster; the team link's secret lives in the server-only
 * `TEAM_SHARE_TOKEN` env, so before this the coach had to hand-build the URL.
 *
 * A Server Component: it reads the token via the `server-only` {@link
 * getTeamShareToken} and passes only the assembled URL and path down to the
 * client {@link ShareLinkField} - the raw token never enters the client bundle
 * beyond the link the coach is meant to copy. When `TEAM_SHARE_TOKEN` is unset
 * the team view is disabled (the route 404s), so instead of a dead link this
 * shows why there is nothing to copy.
 */
export function TeamShareLink({ baseUrl }: { baseUrl?: string }) {
  const token = getTeamShareToken();

  return (
    <Card className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <Heading level={2} size="sub">
          {teamShareContent.coachLink.title}
        </Heading>
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {teamShareContent.coachLink.description}
        </p>
      </div>

      {token ? (
        <ShareLinkField
          url={teamShareUrl(token, baseUrl)}
          path={teamSharePath(token)}
        />
      ) : (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
          {teamShareContent.coachLink.disabled}
        </p>
      )}
    </Card>
  );
}
