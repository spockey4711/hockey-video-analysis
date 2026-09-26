"use client";

/**
 * The tactics board over presentation mode: the full board - tools, pitch
 * and animation bar - filling the presentation, to sketch a move while the
 * team watches or play a scene prepared before. It starts on the default
 * lineup and can switch to an empty pitch or, for a signed-in coach, to a
 * saved scene, loaded through the coach-only scene API with the roster
 * players it links to, whose names the coach can show under the discs.
 * Nothing here is ever saved: the board lives in this browser until the
 * presentation closes.
 *
 * The presentation keeps it mounted once opened and only hides it, so going
 * back to the clip and opening the board again finds it as it was left. Every
 * key press on the board stays on the board: the board keys work as in the
 * editor, `t` or `Escape` goes back to the presentation, and nothing reaches
 * the presentation's own keys (arrows, `p`, `h`, `m`) or the drawing (`d`)
 * underneath.
 *
 * On a second screen the presentation passes what the board shows on to the
 * audience window, which draws the same pitch read-only and without names:
 * the scene it gets carries no roster links.
 */
import {
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { BoardCanvas } from "./BoardCanvas";
import { BoardImageExport } from "./BoardImageExport";
import { BoardToolbar } from "./BoardToolbar";
import { LineLegend } from "./LineLegend";
import { StepsBar } from "./StepsBar";
import { boardKeyAction, isTyping } from "./board-keys";
import {
  boardReducer,
  initialBoardState,
  type BoardState,
} from "./board-state";
import { tacticsContent } from "./content";
import { tokenNames } from "./labels";
import type { BoardRosterPlayer } from "./queries";
import {
  defaultScene,
  emptyScene,
  parseScene,
  type TacticsScene,
} from "./scene";
import { useBoardClipboard } from "./use-board-clipboard";
import { useBoardNames } from "./use-board-names";
import { useOrientation } from "./use-orientation";

import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";
import { Select } from "@/components/forms/Select";
import { isBoardShortcut } from "@/features/share/presentation/presentation-tools";

const copy = tacticsContent.presentation;

/** A saved scene the board can open: its id and name only. */
export interface SceneOption {
  readonly id: string;
  readonly name: string;
}

/** What the board shows: the scene, the step or moment on show, the line being drawn. */
export type PresentationBoardView = Pick<
  BoardState,
  "scene" | "step" | "playback" | "draft"
>;

/** What the board starts from: a fresh lineup, an empty pitch or a saved scene. */
const LINEUP = "lineup";
const EMPTY = "empty";

export interface PresentationBoardProps {
  /**
   * The saved scenes to offer, for a signed-in coach only. Left out, the
   * board offers the lineup and the empty pitch.
   */
  readonly scenes?: readonly SceneOption[];
  /** Whether the board is on show; hidden, it keeps its state. */
  readonly open: boolean;
  /** Go back to the presentation. */
  readonly onClose: () => void;
  /** Hears what the board shows, whenever that changes. */
  readonly onViewChange?: (view: PresentationBoardView) => void;
}

export function PresentationBoard({
  scenes = [],
  open,
  onClose,
  onViewChange,
}: PresentationBoardProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [state, dispatch] = useReducer(boardReducer, null, () =>
    initialBoardState(defaultScene()),
  );
  const orientation = useOrientation();
  const clipboard = useBoardClipboard(state, dispatch);
  const [source, setSource] = useState(LINEUP);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const request = useRef(0);
  // The roster players the loaded scene links to, for the coach only.
  const [roster, setRoster] = useState<readonly BoardRosterPlayer[]>([]);
  const namesChoice = useBoardNames();
  const names =
    namesChoice.shown && roster.length > 0
      ? tokenNames(state.scene.tokens, roster)
      : undefined;

  const { scene, step, playback, draft } = state;
  const reportView = useEffectEvent((view: PresentationBoardView) =>
    onViewChange?.(view),
  );
  useEffect(() => {
    reportView({ scene, step, playback, draft });
  }, [scene, step, playback, draft]);

  // Opening puts the keys on the board; a hidden board stops its animation,
  // so no clock runs behind the clip.
  useEffect(() => {
    if (open) rootRef.current?.focus();
    else dispatch({ type: "pause" });
  }, [open]);

  async function pick(value: string): Promise<void> {
    setSource(value);
    const ticket = ++request.current;
    if (value === LINEUP || value === EMPTY) {
      setStatus("idle");
      const scene = value === LINEUP ? defaultScene() : emptyScene();
      dispatch({ type: "load", scene });
      setRoster([]);
      return;
    }
    setStatus("loading");
    const loaded = await loadScene(value);
    // A later pick wins over a slow answer to an earlier one.
    if (ticket !== request.current) return;
    if (loaded) {
      dispatch({ type: "load", scene: loaded.scene });
      setRoster(loaded.roster);
    }
    setStatus(loaded ? "idle" : "failed");
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    // The presentation and its drawing listen further up; none of their keys
    // is meant while the board is up.
    event.stopPropagation();
    if (isBoardShortcut(event) && !isTyping(event.target)) {
      event.preventDefault();
      onClose();
      return;
    }
    // Escape on a token, line or shape lets go of it first (see `BoardCanvas`).
    if (event.key === "Escape" && !onBoardItem(event.target)) {
      event.preventDefault();
      onClose();
      return;
    }
    if (clipboard.onKeyDown(event)) {
      event.preventDefault();
      return;
    }
    const action = boardKeyAction(event, state);
    if (!action) return;
    event.preventDefault();
    dispatch(action);
  }

  return (
    <section
      ref={rootRef}
      aria-label={copy.label}
      tabIndex={-1}
      hidden={!open}
      onKeyDown={onKeyDown}
      className="absolute inset-0 z-20 flex flex-col gap-[var(--space-3)] overflow-y-auto bg-[var(--bg-app)] px-[var(--space-4)] py-[var(--space-3)] outline-none"
    >
      {/* The picker and the way back wrap under the title on a narrow screen. */}
      <div className="flex flex-wrap items-end justify-between gap-[var(--space-3)]">
        <PanelHeader
          className="min-w-[min(100%,calc(var(--space-16)*5))] flex-1"
          title={copy.label}
          hint={
            <span role="status">
              {status === "loading"
                ? copy.loading
                : status === "failed"
                  ? copy.loadFailed
                  : copy.hint}
            </span>
          }
        />
        <div className="flex flex-wrap items-end gap-[var(--space-3)]">
          <Select
            label={copy.source}
            value={source}
            onChange={(event) => void pick(event.target.value)}
            options={[
              { value: LINEUP, label: copy.lineup },
              { value: EMPTY, label: copy.empty },
              ...scenes.map((scene) => ({
                value: scene.id,
                label: scene.name,
              })),
            ]}
          />
          <BoardImageExport
            state={state}
            name={scenes.find((scene) => scene.id === source)?.name}
            names={names}
          />
          <Button variant="secondary" iconLeft="x" onClick={onClose}>
            {copy.close}
          </Button>
        </div>
      </div>
      <BoardToolbar
        state={state}
        dispatch={dispatch}
        orientation={orientation}
        clipboard={clipboard}
        names={
          roster.length > 0
            ? { shown: namesChoice.shown, onChange: namesChoice.setShown }
            : undefined
        }
      />
      <div className="[container-type:size] min-h-[calc(var(--space-16)*3)] flex-1">
        <BoardCanvas
          state={state}
          dispatch={dispatch}
          orientation={orientation}
          roster={roster}
          names={names}
          fit="container"
        />
      </div>
      <LineLegend
        lines={state.scene.lines}
        className="text-[color:var(--text-secondary)]"
      />
      <StepsBar state={state} dispatch={dispatch} />
    </section>
  );
}

/**
 * Fetch a saved scene and the roster players it links to from the coach-only
 * API, or `null` when it cannot be had. A roster that does not read as one is
 * left out: the board then only names nobody.
 */
async function loadScene(id: string): Promise<{
  scene: TacticsScene;
  roster: readonly BoardRosterPlayer[];
} | null> {
  try {
    const response = await fetch(`/api/tactics/scenes/${id}`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("scene" in body))
      return null;
    const scene = parseScene(body.scene);
    if (!scene) return null;
    return { scene, roster: "roster" in body ? readRoster(body.roster) : [] };
  } catch {
    return null;
  }
}

/** The roster players in an API answer, skipping any entry that is not one. */
function readRoster(value: unknown): BoardRosterPlayer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { id, name, jerseyNumber } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string") return [];
    if (jerseyNumber !== null && typeof jerseyNumber !== "number") return [];
    return [{ id, name, jerseyNumber }];
  });
}

/** Whether a key press was meant for the focused item on the pitch. */
function onBoardItem(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.closest("[data-token-id], [data-line-id], [data-shape-id]") !== null
  );
}
