"use client";

/**
 * The scene editor: the board with its tools, animation steps and selection
 * panel, the coach's private coaching points, and the forms that save,
 * duplicate and delete the scene and save its start arrangement as a
 * formation; the page title renames it. The
 * scene lives in the board reducer until it is saved; a save sends the whole
 * document as JSON, which the server validates before storing (ADR 0010). The
 * coaching points are saved with it but kept beside the document, so they
 * never travel with the scene to a link or the audience window.
 */
import {
  useActionState,
  useEffect,
  useId,
  useReducer,
  useState,
  type KeyboardEvent,
} from "react";

import { BoardCanvas } from "./BoardCanvas";
import { BoardImageExport } from "./BoardImageExport";
import { BoardToolbar } from "./BoardToolbar";
import { BoardVideoExport } from "./BoardVideoExport";
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
import { tokenNames } from "./labels";
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
import { useBoardClipboard } from "./use-board-clipboard";
import { useBoardNames } from "./use-board-names";
import { useOrientation } from "./use-orientation";
import {
  MAX_COACHING_NOTES_LENGTH,
  normalizeCoachingNotes,
} from "./validation";

import { Card } from "@/components/core/Card";
import { Icon } from "@/components/core/Icon";
import { PanelHeader } from "@/components/core/PanelHeader";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { keepValuesOnSubmit } from "@/components/forms/keep-values-on-submit";

const { editor, board, categories, grouping, errors, notes } = tacticsContent;

const CATEGORY_OPTIONS = SCENE_CATEGORIES.map((value) => ({
  value,
  label: categories[value],
}));

/** The coaching points compared as they would be stored. */
function notesKey(text: string): string {
  return normalizeCoachingNotes(text) ?? text;
}

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
  /** The coach's private coaching points, `null` for none. */
  readonly coachingNotes: string | null;
  readonly roster: readonly BoardRosterPlayer[];
}

export function SceneEditor({
  sceneId,
  name,
  category,
  tags,
  scene,
  coachingNotes,
  roster,
}: SceneEditorProps) {
  const [state, dispatch] = useReducer(boardReducer, scene, initialBoardState);
  const orientation = useOrientation();
  const clipboard = useBoardClipboard(state, dispatch);
  // Names come from the coach's roster at render time and never enter the
  // scene, so a saved or shared scene carries none.
  const namesChoice = useBoardNames();
  const names = namesChoice.shown
    ? tokenNames(state.scene.tokens, roster)
    : undefined;
  const sceneJson = JSON.stringify(state.scene);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftTags, setDraftTags] = useState(() => formatSceneTags(tags));
  const [draftNotes, setDraftNotes] = useState(coachingNotes ?? "");
  const [saved, setSaved] = useState({
    json: JSON.stringify(scene),
    category,
    tags: formatSceneTags(tags),
    notes: coachingNotes ?? "",
  });
  const formId = useId();
  const dirty =
    saved.json !== sceneJson ||
    saved.category !== draftCategory ||
    saved.tags !== tagsKey(draftTags) ||
    saved.notes !== notesKey(draftNotes);

  // A successful save makes what was sent the new clean state, so later edits
  // compare against it.
  const [saveState, saveAction, saving] = useActionState(
    async (previous: SceneMutationState, formData: FormData) => {
      const result = await saveSceneAction(previous, formData);
      if (result.status === "success") {
        setSaved({
          json: String(formData.get("scene")),
          category: parseSceneCategory(formData.get("category")) ?? category,
          tags: tagsKey(String(formData.get("tags"))),
          notes: notesKey(String(formData.get("coachingNotes"))),
        });
      }
      return result;
    },
    sceneMutationInitialState,
  );

  // A refused tag list is shown at the tags field, refused coaching points at
  // theirs, every other error beside the save button.
  const saveError = saveState.status === "error" ? saveState.error : undefined;
  const tagsError = saveError === errors.invalidTags ? saveError : undefined;
  const notesError = saveError === errors.invalidNotes ? saveError : undefined;
  const formError = tagsError || notesError ? undefined : saveError;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function onBoardKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (clipboard.onKeyDown(event)) {
      event.preventDefault();
      return;
    }
    const action = boardKeyAction(event, state);
    if (!action) return;
    // The space bar would scroll the page, Ctrl+Z undo in the browser.
    event.preventDefault();
    dispatch(action);
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {/* Without React's reset after the save, the category select keeps
          showing the chosen category rather than its first option. */}
      <form
        id={formId}
        action={saveAction}
        onSubmit={keepValuesOnSubmit(saveAction)}
        className="flex flex-col gap-[var(--space-3)]"
      >
        <input type="hidden" name="sceneId" value={sceneId} />
        <input type="hidden" name="scene" value={sceneJson} />
        <div className="grid items-start gap-[var(--space-3)] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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
          <BoardImageExport state={state} name={name} names={names} />
          <BoardVideoExport scene={state.scene} name={name} names={names} />
          {formError && (
            <p
              role="alert"
              className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
            >
              {formError}
            </p>
          )}
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
        <BoardCanvas
          state={state}
          dispatch={dispatch}
          orientation={orientation}
          roster={roster}
          names={names}
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

      <Card
        as="section"
        aria-label={notes.heading}
        className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]"
      >
        <PanelHeader
          title={
            <span className="inline-flex items-center gap-[var(--space-2)]">
              <Icon name="eye-off" size={14} />
              {notes.heading}
            </span>
          }
          hint={notes.hint}
        />
        {/* Part of the save form above, so the points save with the scene. */}
        <Textarea
          form={formId}
          name="coachingNotes"
          label={notes.label}
          placeholder={notes.placeholder}
          value={draftNotes}
          maxLength={MAX_COACHING_NOTES_LENGTH}
          rows={4}
          error={notesError}
          onChange={(event) => setDraftNotes(event.target.value)}
        />
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
