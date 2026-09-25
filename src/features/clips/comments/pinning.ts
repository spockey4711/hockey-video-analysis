/**
 * Pure ordering for the coach's highlighted comments. A coach comment (posted
 * through a coach session, see `comments.is_coach`) is pinned above the rest of
 * a clip's thread, and the most recent one doubles as the clip's subtitle on the
 * collection share link. Kept free of React and the database so the thread, the
 * coach's insights and the share page order comments the same way.
 *
 * Every function expects its input oldest first, the order the comments API and
 * queries return; they never reorder by time themselves.
 */

/** The one field the ordering reads; both the row and the API view carry it. */
interface Pinnable {
  readonly isCoach: boolean;
}

/**
 * Coach comments first, newest on top, then every other comment oldest first
 * so it still reads as a thread. Returns a new array; the input is untouched.
 */
export function pinCoachComments<T extends Pinnable>(
  comments: readonly T[],
): T[] {
  const coach = comments.filter((comment) => comment.isCoach).reverse();
  const rest = comments.filter((comment) => !comment.isCoach);
  return [...coach, ...rest];
}

/**
 * The most recent coach comment per clip, keyed by clip id. Clips without a
 * coach comment are absent, so their subtitle stays as before.
 */
export function latestCoachCommentByClip<
  T extends Pinnable & { readonly clipId: string },
>(comments: readonly T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const comment of comments) {
    if (comment.isCoach) latest.set(comment.clipId, comment);
  }
  return latest;
}
