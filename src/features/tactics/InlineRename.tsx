"use client";

/**
 * Rename a stored scene or formation in place: the name with a pencil button
 * beside it, which swaps both for a name field. Enter or the save button
 * stores the new name alone, so unsaved board edits stay with the editor;
 * Escape or the cancel button puts the name back. The editor title and each
 * list row use it, so a coach renames the same way everywhere.
 */
import {
  useActionState,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { tacticsContent } from "./content";
import { sceneMutationInitialState, type SceneMutationState } from "./state";
import { MAX_SCENE_NAME_LENGTH } from "./validation";

import { cn } from "@/components/core/cn";
import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";
import { Input } from "@/components/forms/Input";

const { rename } = tacticsContent;

export interface InlineRenameProps {
  /** The form field the id is sent in. */
  readonly idField: string;
  readonly id: string;
  /** The stored name, refreshed by the server after a rename. */
  readonly name: string;
  readonly action: (
    prev: SceneMutationState,
    formData: FormData,
  ) => Promise<SceneMutationState>;
  /** Accessible name of the name field. */
  readonly fieldLabel: string;
  /** Accessible name of the pencil button, naming what it renames. */
  readonly openLabel: string;
  /**
   * In a page title: "Umbenennen" beside the pencil and a field and buttons
   * sized to the heading, so the swap reads as editing the title itself.
   */
  readonly title?: boolean;
  /** The name as shown while not renaming: a heading or a link. */
  readonly children: ReactNode;
  readonly className?: string;
}

export function InlineRename({
  idField,
  id,
  name,
  action,
  fieldLabel,
  openLabel,
  title = false,
  children,
  className,
}: InlineRenameProps) {
  const [state, formAction, pending] = useActionState(
    action,
    sceneMutationInitialState,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [handled, setHandled] = useState(state);
  // The error shown in the open form; cleared on reopen so a cancelled
  // rename's error never greets the next one.
  const [error, setError] = useState<string | undefined>(undefined);
  // Back on the pencil after a rename or a cancel, so a keyboard user keeps
  // their place; never on the first render, which must not steal focus.
  const [refocus, setRefocus] = useState(false);

  // React to each new action result once: show its error, or leave edit mode
  // on success. Adjusting state during render (guarded on the state object so
  // it runs once) is React's recommended alternative to a state-setting effect.
  if (state !== handled) {
    setHandled(state);
    if (state.status === "success") {
      setEditing(false);
      setRefocus(true);
    } else {
      setError(state.error);
    }
  }

  function open(): void {
    setDraft(name);
    setError(undefined);
    setEditing(true);
  }

  function cancel(): void {
    setEditing(false);
    setRefocus(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Escape") return;
    // Escape would otherwise also close a surrounding layer.
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }

  if (!editing) {
    return (
      <div
        className={cn(
          "flex min-w-0 gap-[var(--space-2)]",
          // A title that wraps keeps the button on its first line.
          title ? "items-start" : "items-center",
          className,
        )}
      >
        {children}
        {title ? (
          // Centred on the first line of a page-size heading.
          <Button
            autoFocus={refocus}
            type="button"
            size="sm"
            variant="ghost"
            iconLeft="pencil"
            aria-label={openLabel}
            title={openLabel}
            onClick={open}
            className="relative mt-[calc((var(--fs-h2)*var(--lh-heading)-var(--control-sm))/2)] shrink-0 pointer-coarse:mt-[calc((var(--fs-h2)*var(--lh-heading)-var(--control-lg))/2)] pointer-coarse:h-[var(--control-lg)]"
          >
            {rename.open}
          </Button>
        ) : (
          <IconButton
            autoFocus={refocus}
            name="pencil"
            label={openLabel}
            onClick={open}
            className="relative shrink-0 pointer-coarse:size-[var(--control-lg)]"
          />
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={cn(
        "relative flex min-w-0 flex-wrap items-start gap-[var(--space-2)]",
        className,
      )}
    >
      <input type="hidden" name={idField} value={id} />
      <div className="min-w-0 flex-1 basis-[16rem]">
        <Input
          name="name"
          aria-label={fieldLabel}
          value={draft}
          maxLength={MAX_SCENE_NAME_LENGTH}
          autoComplete="off"
          required
          autoFocus
          readOnly={pending}
          className={
            title
              ? "h-[var(--control-lg)] text-[length:var(--fs-h3)] [font-weight:var(--fw-semibold)]"
              : undefined
          }
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          error={error}
          hint={rename.hint}
        />
      </div>
      <div className="flex shrink-0 gap-[var(--space-2)]">
        <Button
          type="submit"
          size={title ? "lg" : "md"}
          iconLeft="check"
          disabled={pending}
          className="pointer-coarse:h-[var(--control-lg)]"
        >
          {pending ? rename.saving : rename.save}
        </Button>
        <Button
          type="button"
          size={title ? "lg" : "md"}
          variant="ghost"
          disabled={pending}
          onClick={cancel}
          className="pointer-coarse:h-[var(--control-lg)]"
        >
          {rename.cancel}
        </Button>
      </div>
    </form>
  );
}
