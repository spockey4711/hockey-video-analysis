"use client";

/**
 * Coach-facing picker that links players to a tag and sets its visibility
 * (P0-7, PRD 5.2). Mounts inline in a tag row (P0-8's `TagList`) and drives the
 * `GET`/`PUT /api/tags/[id]/players` route - live data never touches the DB from
 * the client (see the stack notes). The roster is loaded server-side and passed
 * in; only the tag's current links are fetched here, when the editor opens.
 *
 * It mirrors the server invariant so an invalid set is never submitted: a
 * `single` (player-specific) tag must name at least one player, otherwise its
 * clip surfaces on no share link at all (P0-11).
 */
import { useEffect, useState } from "react";

import { tagPlayersContent } from "./content";
import type { RosterPlayer, TagPlayers } from "./queries";
import type { Visibility } from "./validation";

import { PlayerChip } from "@/components/data/PlayerChip";
import { Button } from "@/components/forms/Button";

export interface TagPlayersEditorProps {
  /** The tag whose players and visibility are being set. */
  readonly tagId: string;
  /** All selectable players, loaded server-side (may be empty). */
  readonly roster: readonly RosterPlayer[];
  /** The tag's known visibility, shown until the current links load. */
  readonly initialVisibility: Visibility;
  /** Called with the persisted set after a successful save. */
  readonly onSaved: (result: TagPlayers) => void;
  /** Called when the coach dismisses the editor without saving. */
  readonly onCancel: () => void;
}

/** The two visibility choices, in display order (team is the default). */
const VISIBILITY_OPTIONS: readonly {
  value: Visibility;
  label: string;
}[] = [
  { value: "team", label: tagPlayersContent.visibilityTeam },
  { value: "single", label: tagPlayersContent.visibilitySingle },
];

export function TagPlayersEditor({
  tagId,
  roster,
  initialVisibility,
  onSaved,
  onCancel,
}: TagPlayersEditorProps) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the tag's current links when the editor opens. Visibility is seeded
  // from the prop so the control is correct even before this resolves; the
  // response is authoritative for both the set and the visibility.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/tags/${tagId}/players`);
        if (!response.ok)
          throw new Error(`load failed with ${response.status}`);
        const { tagPlayers } = (await response.json()) as {
          tagPlayers: TagPlayers;
        };
        if (!active) return;
        setVisibility(tagPlayers.visibility);
        setSelected(new Set(tagPlayers.playerIds));
      } catch {
        if (active) setError(tagPlayersContent.errors.load);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tagId]);

  function toggle(playerId: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  // A `single` tag with no player is unreachable, so block saving it - the
  // server rejects it too, but guarding here keeps the invariant obvious.
  const singleWithoutPlayer = visibility === "single" && selected.size === 0;
  const canSave = !loading && !busy && !singleWithoutPlayer;

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tags/${tagId}/players`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility, playerIds: [...selected] }),
      });
      if (!response.ok) throw new Error(`save failed with ${response.status}`);
      const { tagPlayers } = (await response.json()) as {
        tagPlayers: TagPlayers;
      };
      onSaved(tagPlayers);
    } catch {
      setError(tagPlayersContent.errors.save);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <fieldset className="flex flex-col gap-[var(--space-1)]">
        <legend className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-secondary)] uppercase">
          {tagPlayersContent.visibilityTitle}
        </legend>
        <div className="flex items-center gap-[var(--space-1)]">
          {VISIBILITY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={visibility === option.value ? "primary" : "secondary"}
              aria-pressed={visibility === option.value}
              disabled={busy}
              onClick={() => setVisibility(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-[var(--space-1)]">
        <legend className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-secondary)] uppercase">
          {tagPlayersContent.playersTitle}
        </legend>
        {roster.length === 0 ? (
          <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
            {tagPlayersContent.emptyRoster}
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-1)]">
            {roster.map((player) => (
              <li key={player.id}>
                <label className="flex cursor-pointer items-center gap-[var(--space-2)] select-none">
                  <input
                    type="checkbox"
                    className="accent-[var(--accent)]"
                    checked={selected.has(player.id)}
                    disabled={busy}
                    onChange={() => toggle(player.id)}
                  />
                  <PlayerChip
                    name={player.name}
                    number={player.jerseyNumber ?? undefined}
                    size="sm"
                    showName
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {singleWithoutPlayer && (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {tagPlayersContent.singleNeedsPlayer}
        </p>
      )}

      <div className="flex items-center gap-[var(--space-1)]">
        <Button size="sm" disabled={!canSave} onClick={() => void save()}>
          {busy
            ? tagPlayersContent.saving
            : loading
              ? tagPlayersContent.loading
              : tagPlayersContent.save}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          {tagPlayersContent.cancel}
        </Button>
      </div>

      <p
        aria-live="polite"
        role="status"
        className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)] empty:hidden"
      >
        {error ?? ""}
      </p>
    </div>
  );
}
