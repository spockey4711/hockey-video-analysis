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
import { BoardImageExport } from "./BoardImageExport";
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
import {
  formatSceneTags,
  normalizeSceneTags,
  parseSceneCategory,
  SCENE_CATEGORIES,
  type SceneCategory,
} from "./library";
import type { BoardRosterPlayer } from "./queries";
import type { TacticsScene } from "./scene";
import { sceneMutationInitialState, type SceneMutationState } from "./state";
import { useOrientation } from "./use-orientation";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Card } from "@/components/core/Card";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";

const { editor, board, categories, grouping, errors } = tacticsContent;

const CATEGORY_OPTIONS = SCENE_CATEGORIES.map((value) => ({
  value,
  label: categories[value],
}));

/** The tags field compared as it would be stored, so spacing is no edit. */
function tagsKey(text: string): string {
  return formatSceneTags(normalizeSceneTags(text) ?? [text]);
}

export interface SceneEditorProps {
  readonly sceneId: string;
  readonly name: string;
  readonly category: SceneCategory;
  readonly tags: readonly string[];
  readonly scene: TacticsScene;
  readonly roster: readonly BoardRosterPlayer[];
}

export function SceneEditor({
  sceneId,
  name,
  category,
  tags,
  scene,
  roster,
}: SceneEditorProps) {
  const [state, dispatch] = useReducer(boardReducer, scene, initialBoardState);
  const orientation = useOrientation();
  const sceneJson = JSON.stringify(state.scene);
  const [draftName, setDraftName] = useState(name);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftTags, setDraftTags] = useState(() => formatSceneTags(tags));
  const [saved, setSaved] = useState({
    json: JSON.stringify(scene),
    name,
    category,
    tags: formatSceneTags(tags),
  });
  const dirty =
    saved.json !== sceneJson ||
    saved.name !== draftName.trim() ||
    saved.category !== draftCategory ||
    saved.tags !== tagsKey(draftTags);

  // A successful save makes what was sent the new clean state, so later edits
  // compare against it.
  const [saveState, saveAction, saving] = useActionState(
    async (previous: SceneMutationState, formData: FormData) => {
      const result = await saveSceneAction(previous, formData);
      if (result.status === "success") {
        setSaved({
          json: String(formData.get("scene")),
          name: String(formData.get("name")).trim(),
          category: parseSceneCategory(formData.get("category")) ?? category,
          tags: tagsKey(String(formData.get("tags"))),
        });
      }
      return result;
    },
    sceneMutationInitialState,
  );

  // A refused tag list is shown at the tags field, every other error at the name.
  const saveError = saveState.status === "error" ? saveState.error : undefined;
  const tagsError = saveError === errors.invalidTags ? saveError : undefined;

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
      <form action={saveAction} className="flex flex-col gap-[var(--space-3)]">
        <input type="hidden" name="sceneId" value={sceneId} />
        <input type="hidden" name="scene" value={sceneJson} />
        <div className="grid items-start gap-[var(--space-3)] md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,3fr)]">
          <Input
            name="name"
            label={editor.nameLabel}
            value={draftName}
            maxLength={MAX_SCENE_NAME_LENGTH}
            autoComplete="off"
            required
            onChange={(event) => setDraftName(event.target.value)}
            error={tagsError ? undefined : saveError}
          />
          <Select
            name="category"
            label={grouping.category}
            options={CATEGORY_OPTIONS}
            value={draftCategory}
            onChange={(event) =>
              setDraftCategory(
                parseSceneCategory(event.target.value) ?? draftCategory,
              )
            }
          />
          <Input
            name="tags"
            label={grouping.tags}
            placeholder={grouping.tagsPlaceholder}
            hint={grouping.tagsHint}
            error={tagsError}
            value={draftTags}
            autoComplete="off"
            onChange={(event) => setDraftTags(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-[var(--space-3)]">
          <Button type="submit" disabled={saving} iconLeft="check">
            {saving ? editor.saving : editor.save}
          </Button>
          <BoardImageExport state={state} name={draftName} />
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
