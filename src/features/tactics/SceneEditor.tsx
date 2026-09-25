"use client";

/**
 * The scene editor: the board with its tools, animation steps and selection
 * panel, and the forms that save, rename, duplicate and delete the scene. The scene lives in
 * the board reducer until it is saved; a save sends the whole document as
 * JSON, which the server validates before storing (ADR 0010).
 */
import {
  useActionState,
  useEffect,
  useReducer,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import { BoardCanvas } from "./BoardCanvas";
import { BoardToolbar } from "./BoardToolbar";
import { SelectionPanel } from "./SelectionPanel";
import { StepsBar } from "./StepsBar";
import {
  deleteSceneAction,
  duplicateSceneAction,
  saveSceneAction,
} from "./actions";
import { boardReducer, initialBoardState } from "./board-state";
import { tacticsContent } from "./content";
import type { Orientation } from "./geometry";
import type { BoardRosterPlayer } from "./queries";
import type { TacticsScene } from "./scene";
import {
  sceneMutationInitialState,
  sceneRedirectInitialState,
  type SceneMutationState,
} from "./state";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Card } from "@/components/core/Card";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { nextStrokeWidth } from "@/features/player/telestration/state";

const { editor, board } = tacticsContent;

/** A phone held upright gets the pitch turned upright too. */
const PORTRAIT_QUERY = "(max-width: 639px) and (orientation: portrait)";

function subscribeToPortrait(onChange: () => void): () => void {
  const query = window.matchMedia(PORTRAIT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useOrientation(): Orientation {
  const portrait = useSyncExternalStore(
    subscribeToPortrait,
    () => window.matchMedia(PORTRAIT_QUERY).matches,
    () => false,
  );
  return portrait ? "portrait" : "landscape";
}

/** Whether a key press belongs to a text field rather than the board. */
function isTyping(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

/** Whether the space bar already presses the focused control. */
function isPressable(target: EventTarget): boolean {
  return target instanceof HTMLElement && target.tagName === "BUTTON";
}

export interface SceneEditorProps {
  readonly sceneId: string;
  readonly name: string;
  readonly scene: TacticsScene;
  readonly roster: readonly BoardRosterPlayer[];
}

export function SceneEditor({
  sceneId,
  name,
  scene,
  roster,
}: SceneEditorProps) {
  const [state, dispatch] = useReducer(boardReducer, scene, initialBoardState);
  const orientation = useOrientation();
  const sceneJson = JSON.stringify(state.scene);
  const [draftName, setDraftName] = useState(name);
  const [saved, setSaved] = useState({ json: JSON.stringify(scene), name });
  const dirty = saved.json !== sceneJson || saved.name !== draftName.trim();

  // A successful save makes what was sent the new clean state, so later edits
  // compare against it.
  const [saveState, saveAction, saving] = useActionState(
    async (previous: SceneMutationState, formData: FormData) => {
      const result = await saveSceneAction(previous, formData);
      if (result.status === "success") {
        setSaved({
          json: String(formData.get("scene")),
          name: String(formData.get("name")).trim(),
        });
      }
      return result;
    },
    sceneMutationInitialState,
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function onBoardKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (isTyping(event.target)) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      dispatch({ type: "undo" });
    } else if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    } else if (key === "o") {
      dispatch({ type: "toggleLineStyle" });
    } else if (key === "w") {
      dispatch({ type: "setWidth", width: nextStrokeWidth(state.width) });
    } else if (key === " " && !isPressable(event.target)) {
      event.preventDefault();
      dispatch({ type: state.playback?.playing ? "pause" : "play" });
    } else if (key === "b") {
      dispatch({ type: "stepBack" });
    } else if (key === "n") {
      dispatch({ type: "stepForward" });
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <form
        action={saveAction}
        className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-end"
      >
        <input type="hidden" name="sceneId" value={sceneId} />
        <input type="hidden" name="scene" value={sceneJson} />
        <div className="min-w-0 flex-1">
          <Input
            name="name"
            label={editor.nameLabel}
            value={draftName}
            maxLength={MAX_SCENE_NAME_LENGTH}
            autoComplete="off"
            required
            onChange={(event) => setDraftName(event.target.value)}
            error={saveState.status === "error" ? saveState.error : undefined}
          />
        </div>
        <div className="flex items-center gap-[var(--space-3)]">
          <Button type="submit" disabled={saving} iconLeft="check">
            {saving ? editor.saving : editor.save}
          </Button>
          <span
            role="status"
            className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]"
          >
            {dirty
              ? editor.unsaved
              : saveState.status === "success"
                ? editor.saved
                : ""}
          </span>
        </div>
      </form>

      <div
        onKeyDown={onBoardKeyDown}
        className="flex flex-col gap-[var(--space-3)]"
      >
        <BoardToolbar state={state} dispatch={dispatch} />
        <BoardCanvas
          state={state}
          dispatch={dispatch}
          orientation={orientation}
          roster={roster}
        />
        <StepsBar state={state} dispatch={dispatch} />
        <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {board.keyboardHint}
        </p>
      </div>

      <Card className="p-[var(--space-4)]">
        <SelectionPanel state={state} dispatch={dispatch} roster={roster} />
      </Card>

      <SceneActions sceneId={sceneId} />
    </div>
  );
}

/** Duplicate the stored scene, or delete it after a confirm step. */
function SceneActions({ sceneId }: { sceneId: string }) {
  const [duplicateState, duplicateAction, duplicating] = useActionState(
    duplicateSceneAction,
    sceneRedirectInitialState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteSceneAction,
    sceneMutationInitialState,
  );
  const [confirming, setConfirming] = useState(false);
  const error = duplicateState.error ?? deleteState.error;

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      {error && (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <form action={duplicateAction}>
          <input type="hidden" name="sceneId" value={sceneId} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={duplicating}
          >
            {editor.duplicate}
          </Button>
        </form>
        <form
          action={deleteAction}
          className="flex flex-wrap items-center gap-[var(--space-2)]"
        >
          <input type="hidden" name="sceneId" value={sceneId} />
          {confirming ? (
            <>
              <span className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
                {editor.confirmDelete}
              </span>
              <Button
                type="submit"
                size="sm"
                variant="danger"
                disabled={deleting}
              >
                {editor.confirmYes}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                {editor.cancel}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              iconLeft="trash-2"
              className="text-[color:var(--danger)]"
              onClick={() => setConfirming(true)}
            >
              {editor.delete}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
