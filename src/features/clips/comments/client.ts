/**
 * Browser-side access to `GET`/`POST /api/clips/[id]/comments` (P2-3). Kept
 * free of React so the URL building and response decoding are unit-testable
 * and the {@link CommentThread} stays a thin view over these calls. A login-free
 * share viewer passes the share token from the page URL as `?shareToken=`; the
 * signed-in coach passes none and is authorized by the session cookie.
 */
import type { CommentInput } from "./validation";

/** A comment as the API serializes it: `createdAt` is an ISO-8601 string. */
export interface CommentView {
  readonly id: string;
  readonly author: string;
  readonly body: string;
  /** Posted through a coach session; pinned and highlighted in the thread. */
  readonly isCoach: boolean;
  readonly createdAt: string;
}

/** Path of a clip's comments endpoint, with the share token when one is held. */
export function commentsEndpoint(clipId: string, shareToken?: string): string {
  const base = `/api/clips/${encodeURIComponent(clipId)}/comments`;
  if (!shareToken) return base;
  return `${base}?shareToken=${encodeURIComponent(shareToken)}`;
}

/** Load a clip's comments oldest first; throws on any non-2xx response. */
export async function fetchComments(
  clipId: string,
  shareToken?: string,
): Promise<CommentView[]> {
  const response = await fetch(commentsEndpoint(clipId, shareToken));
  if (!response.ok) throw new Error(`load failed with ${response.status}`);
  const { comments } = (await response.json()) as { comments: CommentView[] };
  return comments;
}

export type PostCommentResult =
  | { readonly ok: true; readonly comment: CommentView }
  | { readonly ok: false; readonly reason: "invalid" | "failed" };

/**
 * Post a comment and return the persisted row. A 400 (the server's validation
 * rejected the fields) is reported as `invalid` so the form can say so, every
 * other failure as `failed`.
 */
export async function postComment(
  clipId: string,
  input: CommentInput,
  shareToken?: string,
): Promise<PostCommentResult> {
  const response = await fetch(commentsEndpoint(clipId, shareToken), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status === 400) return { ok: false, reason: "invalid" };
  if (!response.ok) return { ok: false, reason: "failed" };
  const { comment } = (await response.json()) as { comment: CommentView };
  return { ok: true, comment };
}
