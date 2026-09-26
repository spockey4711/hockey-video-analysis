"use client";

/**
 * The formation editor: the scene board with only its placing tools, since a
 * formation is a start arrangement without lines or steps, plus the forms
 * that save its name, kind and positions and duplicate or delete it. The
 * board holds the formation as a scene; a save sends only its view and
 * tokens, which the server validates before storing.
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
import { SelectionPanel } from "./SelectionPanel";
import { boardKeyAction } from "./board-keys";
import { boardReducer, initialBoardState } from "./board-state";
import { tacticsContent } from "./content";
import {
  FORMATION_KINDS,
  formationFromScene,
  sceneFromFormation,
  type FormationKind,
  type TacticsFormation,
} from "./formation";
import {
  deleteFormationAction,
  duplicateFormationAction,
  saveFormationAction,
} from "./formation-actions";
import { sceneMutationInitialState, type SceneMutationState } from "./state";
import { useOrientation } from "./use-orientation";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { Card } from "@/components/core/Card";
import { Button } from "@/components/forms/Button";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";
import { Input } from "@/components/forms/Input";

const { editor, formations } = tacticsContent;

/** A formation has no roster links, so its board offers none. */
const NO_ROSTER = [] as const;

export interface FormationEditorProps {
  readonly formationId: string;
  readonly name: string;
  readonly kind: FormationKind;
  readonly formation: TacticsFormation;
}

export function FormationEditor({
  formationId,
  name,
  kind,
  formation,
}: FormationEditorProps) {
  const [state, dispatch] = useReducer(
    boardReducer,
    formation,
    (start: TacticsFormation) => initialBoardState(sceneFromFormation(start)),
  );
  const orientation = useOrientation();
  const formationJson = JSON.stringify(formationFromScene(state.scene));
  const [draftName, setDraftName] = useState(name);
  const [draftKind, setDraftKind] = useState(kind);
  const [saved, setSaved] = useState({
    json: JSON.stringify(formation),
    name,
    kind,
  });
  const dirty =
    saved.json !== formationJson ||
    saved.name !== draftName.trim() ||
    saved.kind !== draftKind;

  // A successful save makes what was sent the new clean state.
  const [saveState, saveAction, saving] = useActionState(
    async (previous: SceneMutationState, formData: FormData) => {
      const result = await saveFormationAction(previous, formData);
      if (result.status === "success") {
        setSaved({
          json: String(formData.get("formation")),
          name: String(formData.get("name")).trim(),
          kind: formData.get("kind") === "attack" ? "attack" : "defence",
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
    event.preventDefault();
    dispatch(action);
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <form
        action={saveAction}
        className="flex flex-col gap-[var(--space-3)] lg:flex-row lg:items-end"
      >
        <input type="hidden" name="formationId" value={formationId} />
        <input type="hidden" name="formation" value={formationJson} />
        <input type="hidden" name="kind" value={draftKind} />
        <div className="min-w-0 flex-1">
          <Input
            name="name"
            label={formations.label}
            value={draftName}
            maxLength={MAX_SCENE_NAME_LENGTH}
            autoComplete="off"
            required
            onChange={(event) => setDraftName(event.target.value)}
            error={saveState.status === "error" ? saveState.error : undefined}
          />
        </div>
        <ChoiceGroup
          label={formations.kind}
          options={FORMATION_KINDS.map((value) => ({
            value,
            label: formations.kinds[value],
          }))}
          value={draftKind}
          onChange={setDraftKind}
        />
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

      <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
        {formations.editorHint}
      </p>

      <div
        onKeyDown={onBoardKeyDown}
        className="flex flex-col gap-[var(--space-3)]"
      >
        <BoardToolbar state={state} dispatch={dispatch} positionsOnly />
        <BoardCanvas
          state={state}
          dispatch={dispatch}
          orientation={orientation}
          roster={NO_ROSTER}
        />
        <p className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)]">
          {formations.keyboardHint}
        </p>
      </div>

      <Card className="p-[var(--space-4)]">
        <SelectionPanel state={state} dispatch={dispatch} roster={NO_ROSTER} />
      </Card>

      <DocumentActions
        idField="formationId"
        id={formationId}
        duplicateAction={duplicateFormationAction}
        deleteAction={deleteFormationAction}
        confirmDelete={formations.confirmDelete}
      />
    </div>
  );
}
