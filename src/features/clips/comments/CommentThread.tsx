"use client";

/**
 * Read/write comment thread for one clip (P2-3, PRD 5.6). Mounts beside the
 * share playlist (team and per-player links) and in the coach's tag detail, and
 * talks only to `GET`/`POST /api/clips/[id]/comments` - live data never touches
 * the database from the client. A login-free viewer passes the share token from
 * the page URL so the API can check the token reaches this clip; the coach is
 * authorized by the session cookie and passes none.
 *
 * The per-clip state (list, draft body, errors) lives in {@link ClipThread},
 * keyed by `clipId`, so it resets whenever the playlist advances; the typed
 * author name lives one level up and survives, so a viewer commenting on
 * several clips in one session types their name once.
 */
import { type FormEvent, useEffect, useState } from "react";

import { type CommentView, fetchComments, postComment } from "./client";
import { commentsContent } from "./content";
import { formatCommentDate } from "./format-comment-date";
import { AUTHOR_MAX_LENGTH, BODY_MAX_LENGTH } from "./validation";

import { Icon } from "@/components/core/Icon";
import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";

export interface CommentThreadProps {
  /** The clip whose comments are shown and added to. */
  readonly clipId: string;
  /** The share token of the link this thread is reached by; absent for the coach. */
  readonly shareToken?: string;
  /** Render the "Kommentare (n)" heading; off when the host already labels it. */
  readonly showHeading?: boolean;
}

export function CommentThread({
  clipId,
  shareToken,
  showHeading = true,
}: CommentThreadProps) {
  const [author, setAuthor] = useState("");
  return (
    <ClipThread
      key={clipId}
      clipId={clipId}
      shareToken={shareToken}
      showHeading={showHeading}
      author={author}
      onAuthorChange={setAuthor}
    />
  );
}

type ListState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "ready"; readonly comments: readonly CommentView[] };

interface ClipThreadProps {
  readonly clipId: string;
  readonly shareToken: string | undefined;
  readonly showHeading: boolean;
  readonly author: string;
  readonly onAuthorChange: (author: string) => void;
}

function ClipThread({
  clipId,
  shareToken,
  showHeading,
  author,
  onAuthorChange,
}: ClipThreadProps) {
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const comments = await fetchComments(clipId, shareToken);
        if (active) setList({ kind: "ready", comments });
      } catch {
        if (active) setList({ kind: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, [clipId, shareToken]);

  const canSubmit =
    !submitting && author.trim().length > 0 && body.trim().length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await postComment(
        clipId,
        { author: author.trim(), body: body.trim() },
        shareToken,
      );
      if (!result.ok) {
        setSubmitError(
          result.reason === "invalid"
            ? commentsContent.errors.invalid
            : commentsContent.errors.submit,
        );
        return;
      }
      setBody("");
      setList((current) =>
        current.kind === "ready"
          ? { kind: "ready", comments: [...current.comments, result.comment] }
          : { kind: "ready", comments: [result.comment] },
      );
    } catch {
      setSubmitError(commentsContent.errors.submit);
    } finally {
      setSubmitting(false);
    }
  }

  const count = list.kind === "ready" ? list.comments.length : 0;

  return (
    <section
      aria-label={commentsContent.regionLabel}
      className="flex flex-col gap-[var(--space-3)]"
    >
      {showHeading && (
        <h3 className="flex items-center gap-[var(--space-2)] text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-wide)] text-[color:var(--text-secondary)] uppercase">
          <Icon name="message-square" size={14} />
          {commentsContent.heading(count)}
        </h3>
      )}

      {list.kind === "loading" ? (
        <p
          role="status"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]"
        >
          {commentsContent.loading}
        </p>
      ) : list.kind === "error" ? (
        <p
          role="alert"
          className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)]"
        >
          {commentsContent.errors.load}
        </p>
      ) : list.comments.length === 0 ? (
        <p className="text-[length:var(--fs-body-sm)] text-[color:var(--text-muted)]">
          {commentsContent.empty}
        </p>
      ) : (
        <ol className="flex flex-col gap-[var(--space-2)]">
          {list.comments.map((comment) => (
            <li
              key={comment.id}
              className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)] border border-[color:var(--border-subtle)] bg-[var(--surface-inset)] px-[var(--space-3)] py-[var(--space-2)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--space-3)] gap-y-0">
                <span className="text-[length:var(--fs-body-sm)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
                  {comment.author}
                </span>
                <time
                  dateTime={comment.createdAt}
                  className="text-[length:var(--fs-caption)] text-[color:var(--text-muted)] tabular-nums"
                >
                  {formatCommentDate(comment.createdAt)}
                </time>
              </div>
              <p className="text-[length:var(--fs-body-sm)] leading-[var(--lh-body)] break-words whitespace-pre-wrap text-[color:var(--text-secondary)]">
                {comment.body}
              </p>
            </li>
          ))}
        </ol>
      )}

      <form
        aria-label={commentsContent.form.label}
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-[var(--space-2)]"
      >
        <Input
          label={commentsContent.form.authorLabel}
          placeholder={commentsContent.form.authorPlaceholder}
          value={author}
          maxLength={AUTHOR_MAX_LENGTH}
          autoComplete="name"
          disabled={submitting}
          onChange={(event) => onAuthorChange(event.target.value)}
        />
        <Textarea
          label={commentsContent.form.bodyLabel}
          placeholder={commentsContent.form.bodyPlaceholder}
          value={body}
          maxLength={BODY_MAX_LENGTH}
          disabled={submitting}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="flex items-center gap-[var(--space-3)]">
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {submitting
              ? commentsContent.form.submitting
              : commentsContent.form.submit}
          </Button>
          <p
            role="status"
            aria-live="polite"
            className="text-[length:var(--fs-body-sm)] text-[color:var(--danger)] empty:hidden"
          >
            {submitError ?? ""}
          </p>
        </div>
      </form>
    </section>
  );
}
