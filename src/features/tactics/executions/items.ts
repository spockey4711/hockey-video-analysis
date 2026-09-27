/**
 * The display layer for a scene's executions: the picker's filter read from
 * the URL, each tagged moment's German label, and the executions playlist
 * built for the shared clip player. Pure, so the server pages stay thin and
 * every mapping is unit-tested.
 */
import { executionsContent } from "./content";
import type { ExecutionOutcome } from "./outcome";
import type { ExecutionTag, SceneExecution } from "./queries";

import { formatGameTime } from "@/components/data/format-timecode";
import { toPlaybackPlan } from "@/features/clip-edits/playback";
import type { ClipStatus } from "@/features/clips/status";
import { resolveSourceUrl } from "@/features/player/player-sources";
import type { PlaylistItem } from "@/features/share/playlist/types";
import { isTagTypeKey, tagTypesLabel } from "@/lib/tag-types";

/** The tag type the picker starts on: executions are mostly short corners. */
export const DEFAULT_PICKER_TYPE = "corner_short";

/** The picker's type choice that lists every tag type. */
export const ANY_TYPE = "all";

/** Which tagged moments the picker lists; `null` lists all of them. */
export interface PickerFilter {
  readonly type: string | null;
  readonly gameId: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Read the picker's filter from its URL. No type, or an unknown one, starts
 * on short corners; `all` lists every type. A game that is not an id lists
 * every game.
 */
export function parsePickerFilter(
  params: Record<string, string | string[] | undefined>,
): PickerFilter {
  const type = first(params.type);
  const gameId = first(params.game);
  return {
    type:
      type === ANY_TYPE
        ? null
        : type !== undefined && isTagTypeKey(type)
          ? type
          : DEFAULT_PICKER_TYPE,
    gameId: gameId !== undefined && UUID_RE.test(gameId) ? gameId : null,
  };
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * A tag's types as German labels ("Ecke kurz + Tor", ADR 0016), a type's
 * stored key when it was retired.
 */
export function tagLabel(
  tag: Pick<ExecutionTag, "tagType" | "extraTypes">,
): string {
  return tagTypesLabel({ type: tag.tagType, extraTypes: tag.extraTypes });
}

/** A game as the executions name it: title, opponent and date. */
export function momentGameLabel(game: {
  readonly title: string;
  readonly opponent: string | null;
  readonly playedOn: string | null;
}): string {
  return [
    game.title,
    game.opponent
      ? `${executionsContent.opponentPrefix} ${game.opponent}`
      : null,
    game.playedOn
      ? DATE_FORMAT.format(new Date(`${game.playedOn}T00:00:00Z`))
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" - ");
}

/** Where a moment happened: its game and its game-time mark. */
export function momentSubtitle(tag: ExecutionTag): string {
  const game = momentGameLabel({
    title: tag.gameTitle,
    opponent: tag.gameOpponent,
    playedOn: tag.playedOn,
  });
  return `${game} - ${formatGameTime(tag.startS).main}`;
}

/** One execution as the scene's card lists it. */
export interface ExecutionRowView {
  readonly tagId: string;
  readonly gameId: string;
  readonly startS: number;
  readonly title: string;
  readonly subtitle: string;
  readonly outcome: ExecutionOutcome;
  /** The tag's newest clip's state, `null` when none was cut. */
  readonly clipStatus: ClipStatus | null;
}

/** The scene's executions as its card lists them, in play order. */
export function toExecutionRows(
  executions: readonly SceneExecution[],
): ExecutionRowView[] {
  return executions.map((execution) => ({
    tagId: execution.tagId,
    gameId: execution.gameId,
    startS: execution.startS,
    title: tagLabel(execution),
    subtitle: momentSubtitle(execution),
    outcome: execution.outcome,
    clipStatus: execution.clip?.status ?? null,
  }));
}

/**
 * The executions playlist for the shared clip player: every execution whose
 * newest clip is ready, in play order, playing its tag window (ADR 0011). The
 * title names the tag type and how it went; the stored file path is resolved
 * against `mediaBaseUrl` here, so the player only gets a loadable URL.
 */
export function toExecutionPlaylist(
  executions: readonly SceneExecution[],
  mediaBaseUrl: string | undefined,
): PlaylistItem[] {
  return executions.flatMap(({ clip, ...execution }) =>
    clip?.status === "ready" && clip.outputPath !== null
      ? [
          {
            id: clip.id,
            src: resolveSourceUrl(clip.outputPath, mediaBaseUrl),
            title: `${tagLabel(execution)} - ${executionsContent.outcomes[execution.outcome]}`,
            subtitle: momentSubtitle({ ...execution, clip }),
            plan: toPlaybackPlan(null, {
              cutStartS: clip.cutStartS,
              window: { startS: execution.startS, endS: execution.endS },
            }),
            frameRate: execution.frameRate,
          },
        ]
      : [],
  );
}

/** One tagged moment the picker offers. */
export interface PickerRowView {
  readonly tagId: string;
  readonly title: string;
  readonly subtitle: string;
  /** The tag's newest clip's state, `null` when none was cut. */
  readonly clipStatus: ClipStatus | null;
  /** Whether the tag is already linked to the scene. */
  readonly linked: boolean;
}

/** The picker's tagged moments, in the order the query returned them. */
export function toPickerRows(
  candidates: readonly ExecutionTag[],
  linked: ReadonlySet<string>,
): PickerRowView[] {
  return candidates.map((tag) => ({
    tagId: tag.tagId,
    title: tagLabel(tag),
    subtitle: momentSubtitle(tag),
    clipStatus: tag.clip?.status ?? null,
    linked: linked.has(tag.tagId),
  }));
}
