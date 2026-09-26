"use client";

/**
 * The tactics board over presentation mode: the full board - tools, pitch
 * and animation bar - filling the presentation, to sketch a move while the
 * team watches or play a scene prepared before. It starts on the default
 * lineup and can switch to an empty pitch or, for a signed-in coach, to a
 * saved scene, loaded through the coach-only scene API. Nothing here is ever
 * saved: the board lives in this browser until the presentation closes.
 *
 * The presentation keeps it mounted once opened and only hides it, so going
 * back to the clip and opening the board again finds it as it was left. Every
 * key press on the board stays on the board: the board keys work as in the
 * editor, `t` or `Escape` goes back to the presentation, and nothing reaches
 * the presentation's own keys (arrows, `p`, `h`, `m`) or the drawing (`d`)
 * underneath.
 */
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { BoardCanvas } from "./BoardCanvas";
import { BoardToolbar } from "./BoardToolbar";
import { StepsBar } from "./StepsBar";
import { boardKeyAction, isTyping } from "./board-keys";
import { boardReducer, initialBoardState } from "./board-state";
import { tacticsContent } from "./content";
import {
  defaultScene,
  emptyScene,
  parseScene,
  type TacticsScene,
} from "./scene";
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
}

export function PresentationBoard({
  scenes = [],
  open,
  onClose,
}: PresentationBoardProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [state, dispatch] = useReducer(boardReducer, null, () =>
    initialBoardState(defaultScene()),
  );
  const orientation = useOrientation();
  const [source, setSource] = useState(LINEUP);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const request = useRef(0);

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
      return;
    }
    setStatus("loading");
    const scene = await loadScene(value);
    // A later pick wins over a slow answer to an earlier one.
    if (ticket !== request.current) return;
    if (scene) dispatch({ type: "load", scene });
    setStatus(scene ? "idle" : "failed");
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
    // Escape on a token or line lets go of it first (see `BoardCanvas`).
    if (event.key === "Escape" && !onBoardItem(event.target)) {
      event.preventDefault();
      onClose();
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
      <PanelHeader
        title={copy.label}
        hint={
          status === "loading"
            ? copy.loading
            : status === "failed"
              ? copy.loadFailed
              : copy.hint
        }
        action={
          <div className="flex flex-wrap items-end justify-end gap-[var(--space-3)]">
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
            <Button variant="secondary" iconLeft="x" onClick={onClose}>
              {copy.close}
            </Button>
          </div>
        }
      />
      <BoardToolbar state={state} dispatch={dispatch} />
      <div className="[container-type:size] min-h-[calc(var(--space-16)*3)] flex-1">
        <BoardCanvas
          state={state}
          dispatch={dispatch}
          orientation={orientation}
          roster={[]}
          fit="container"
        />
      </div>
      <StepsBar state={state} dispatch={dispatch} />
    </section>
  );
}

/** Fetch a saved scene from the coach-only API, or `null` when it cannot be had. */
async function loadScene(id: string): Promise<TacticsScene | null> {
  try {
    const response = await fetch(`/api/tactics/scenes/${id}`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && "scene" in body
      ? parseScene(body.scene)
      : null;
  } catch {
    return null;
  }
}

/** Whether a key press was meant for the focused token or line on the pitch. */
function onBoardItem(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.closest("[data-token-id], [data-line-id]") !== null
  );
}
