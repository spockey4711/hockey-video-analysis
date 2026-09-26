"use client";

/**
 * The scene editor: the board with its tools, animation steps and selection
 * panel, and the forms that save, rename, duplicate and delete the scene and
 * save its start arrangement as a formation. The
 * scene lives in the board reducer until it is saved; a save sends the whole
 * document as JSON, which the server validates before storing (ADR 0010).
 */
import {
  useActionState,
  useEffect,
  useReducer,
  useState,
  type KeyboardEvent,
} from "react";

import { BoardCanvas } from "./BoardCanvas";
import { BoardToolbar } from "./BoardToolbar";
import { DocumentActions } from "./DocumentActions";
import { LineLegend } from "./LineLegend";
import { SaveAsFormation } from "./SaveAsFormation";
import { SelectionPanel } from "./SelectionPanel";
import { StepsBar } from "./StepsBar";
import {
  deleteSceneAction,
  duplicateSceneAction,
  saveSceneAction,
} from "./actions";
import { boardKeyAction } from "./board-keys";
import { boardReducer, initialBoardState } from "./board-state";
import { tacticsContent } from "./content";
import type { BoardRosterPlayer } from "./queries";
import type { TacticsScene } from "./scene";
import { sceneMutationInitialState, type SceneMutationState } from "./state";
import { useOrientation } from "./use-orientation";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Card } from "@/components/core/Card";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";

const { editor, board } = tacticsContent;

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
    const action = boardKeyAction(event, state);
    if (!action) return;
    // The space bar would scroll the page, Ctrl+Z undo in the browser.
    event.preventDefault();
    dispatch(action);
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
        <LineLegend
          lines={state.scene.lines}
          className="text-[color:var(--text-secondary)]"
        />
        <StepsBar state={state} dispatch={dispatch} />
        <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {board.keyboardHint}
        </p>
      </div>

      <Card className="p-[var(--space-4)]">
        <SelectionPanel state={state} dispatch={dispatch} roster={roster} />
      </Card>

      <SaveAsFormation sceneJson={sceneJson} />

      <DocumentActions
        idField="sceneId"
        id={sceneId}
        duplicateAction={duplicateSceneAction}
        deleteAction={deleteSceneAction}
        confirmDelete={editor.confirmDelete}
      />
    </div>
  );
}
