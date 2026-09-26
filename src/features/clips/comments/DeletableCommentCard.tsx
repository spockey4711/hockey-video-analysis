"use client";

import { useEffect, useRef, useState } from "react";

import { CommentCard, type CommentCardProps } from "./CommentCard";
import { deleteComment } from "./client";
import { commentsContent } from "./content";

import { Button } from "@/components/forms/Button";
import { IconButton } from "@/components/forms/IconButton";

export interface DeletableCommentCardProps extends Omit<
  CommentCardProps,
  "action" | "footer"
> {
  readonly clipId: string;
  readonly commentId: string;
  /** Called once the comment is gone, so the host drops or reloads it. */
  readonly onDeleted: () => void;
}

type Mode = "view" | "confirm" | "deleting";

/**
 * A comment card with the coach's delete control (moderation). The trash button
 * opens an inline confirm step rather than deleting at once; confirming calls
 * `DELETE /api/clips/[id]/comments/[commentId]` and hands over to `onDeleted`.
 * Only mounted on coach surfaces - the share links render the plain
 * {@link CommentCard}, and the route refuses a share token regardless.
 *
 * Focus follows the step: opening the confirm moves it to "Abbrechen" (the safe
 * choice, so a second Enter never deletes), cancelling returns it to the trash
 * button.
 */
export function DeletableCommentCard({
  clipId,
  commentId,
  onDeleted,
  ...card
}: DeletableCommentCardProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [failed, setFailed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (mode === "confirm") {
      cancelRef.current?.focus();
    } else if (mode === "view" && returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [mode]);

  async function confirmDelete() {
    setMode("deleting");
    setFailed(false);
    let deleted = false;
    try {
      deleted = await deleteComment(clipId, commentId);
    } catch {
      deleted = false;
    }
    if (deleted) {
      onDeleted();
      return;
    }
    setFailed(true);
    setMode("confirm");
  }

  function cancel() {
    setFailed(false);
    returnFocus.current = true;
    setMode("view");
  }

  const busy = mode === "deleting";

  return (
    <CommentCard
      {...card}
      action={
        mode === "view" ? (
          <IconButton
            ref={triggerRef}
            name="trash-2"
            size="sm"
            label={commentsContent.delete.label(card.author)}
            onClick={() => setMode("confirm")}
          />
        ) : null
      }
      footer={
        mode === "view" ? null : (
          <div
            role="group"
            aria-label={commentsContent.delete.label(card.author)}
            className="mt-[var(--space-1)] flex flex-col gap-[var(--space-2)] border-t border-[color:var(--border-subtle)] pt-[var(--space-2)]"
          >
            <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-secondary)]">
              {commentsContent.delete.confirm}
            </p>
            {failed && (
              <p
                role="alert"
                className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
              >
                {commentsContent.delete.error}
              </p>
            )}
            <div className="flex flex-wrap gap-[var(--space-2)]">
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => void confirmDelete()}
              >
                {busy
                  ? commentsContent.delete.deleting
                  : commentsContent.delete.confirmYes}
              </Button>
              <Button
                ref={cancelRef}
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={cancel}
              >
                {commentsContent.delete.cancel}
              </Button>
            </div>
          </div>
        )
      }
    />
  );
}
