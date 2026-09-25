import { ShareLinkField } from "./ShareLinkField";

import { Card } from "@/components/core/Card";
import { RotateShareTokenForm } from "@/features/access/rotation";
import { DeletePlayerForm } from "@/features/players/gdpr";
import {
  playerSharePath,
  playerShareUrl,
  type PlayerRosterItem,
} from "@/features/players/roster";
import { EditablePlayerName } from "@/features/players/setup";

/**
 * One roster row: the player's name and jersey number (editable in place), their
 * secret share link, and the two coach-only controls - rotate the share token
 * (revoking the current link) and erase the player and their data. Server-rendered; the interactive
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
      <EditablePlayerName
        playerId={player.id}
        name={player.name}
        jerseyNumber={player.jerseyNumber}
      />

      <ShareLinkField url={url} path={path} />

      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <RotateShareTokenForm playerId={player.id} />
        <DeletePlayerForm playerId={player.id} />
      </div>
    </Card>
  );
}
