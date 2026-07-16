import { ShareLinkField } from "./ShareLinkField";

import { Card } from "@/components/core/Card";
import { Heading } from "@/components/core/Heading";
import { RotateShareTokenForm } from "@/features/access/rotation";
import { DeletePlayerForm } from "@/features/players/gdpr";
import {
  playerSharePath,
  playerShareUrl,
  rosterContent,
  type PlayerRosterItem,
} from "@/features/players/roster";

/**
 * One roster row: the player's name and jersey number, their secret share link,
 * and the two coach-only controls - rotate the share token (revoking the current
 * link) and erase the player and their data. Server-rendered; the interactive
 * bits are the client forms it mounts. `baseUrl` is the app's public URL when
 * known, so the copied link is absolute.
 */
export function PlayerRow({
  player,
  baseUrl,
}: {
  player: PlayerRosterItem;
  baseUrl?: string;
}) {
  const path = playerSharePath(player.shareToken);
  const url = playerShareUrl(player.shareToken, baseUrl);

  return (
    <Card className="flex flex-col gap-[var(--space-4)] p-[var(--space-4)]">
      <div className="flex items-baseline gap-[var(--space-2)]">
        <Heading level={2} size="sub">
          {player.name}
        </Heading>
        {player.jerseyNumber !== null && (
          <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {rosterContent.jerseyPrefix} {player.jerseyNumber}
          </span>
        )}
      </div>

      <ShareLinkField url={url} path={path} />

      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <RotateShareTokenForm playerId={player.id} />
        <DeletePlayerForm playerId={player.id} />
      </div>
    </Card>
  );
}
