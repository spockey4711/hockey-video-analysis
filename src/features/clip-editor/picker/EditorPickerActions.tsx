"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ClipPicker } from "./ClipPicker";
import { NewCollectionForm } from "./NewCollectionForm";
import { PickerDialog } from "./PickerDialog";
import { createCollection, editorPath } from "./client";
import { pickerContent } from "./content";

import { Button } from "@/components/forms/Button";

export interface EditorPickerActionsProps {
  readonly collectionId: string;
  /** Selects a clip the picker just added, once the editor lists it. */
  readonly onAdded: (clipId: string) => void;
}

/**
 * The clip editor's "Clips hinzufügen" and "Neue Sammlung" (ADR 0011), in its
 * header. A clip added through the picker joins the editor's list in play
 * order and is selected there; a new collection opens in this editor window,
 * empty and ready to pick clips into.
 */
export function EditorPickerActions({
  collectionId,
  onAdded,
}: EditorPickerActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<"picker" | "create" | null>(null);
  const [, startTransition] = useTransition();
  const close = () => setOpen(null);

  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <Button size="sm" iconLeft="plus" onClick={() => setOpen("picker")}>
        {pickerContent.picker.open}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen("create")}>
        {pickerContent.create.open}
      </Button>

      <PickerDialog
        open={open === "picker"}
        onClose={close}
        title={pickerContent.picker.open}
      >
        <ClipPicker
          collectionId={collectionId}
          onAdded={(clipId) =>
            // Select the new clip, then reload the entries, in one update so
            // the selection never points at a clip the list lacks. Selecting
            // rewrites the URL, which drops a refresh already under way, so
            // the refresh comes second.
            startTransition(() => {
              onAdded(clipId);
              router.refresh();
            })
          }
        />
      </PickerDialog>

      <PickerDialog
        open={open === "create"}
        onClose={close}
        title={pickerContent.create.open}
      >
        <div className="p-[var(--space-4)]">
          <NewCollectionForm
            label={pickerContent.create.label}
            submitLabel={pickerContent.create.submit}
            autoFocus
            create={async (name) => {
              const outcome = await createCollection(name);
              if (outcome.status === "created") {
                router.push(editorPath(outcome.id));
              }
              return outcome;
            }}
          />
        </div>
      </PickerDialog>
    </div>
  );
}
