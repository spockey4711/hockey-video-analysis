/**
 * The coach's private presenter notes for a collection, as presentation mode
 * receives them. The collection share page passes them in only when the request
 * carries a signed-in coach session, so a viewer of the login-free link never
 * gets them in the HTML, the props or any payload. Nothing here fetches: it is
 * the pure shape plus the helpers that pick what to show.
 */
export interface PresenterNotes {
  /** The note for the whole collection, shown on the first clip; `null` when none. */
  readonly collection: string | null;
  /** Each clip's note by clip id; clips without a note are left out. */
  readonly clips: Readonly<Record<string, string>>;
}

/** What the presenter panel shows on one clip. */
export interface PresenterNotesView {
  /** The collection note, only on the first clip. */
  readonly collection: string | null;
  /** The current clip's note, `null` when it has none. */
  readonly clip: string | null;
}

/**
 * Narrow stored notes to the clips the link actually plays, or `undefined` when
 * nothing is left to show, so presentation mode offers no empty notes panel.
 */
export function presenterNotesForClips(
  notes: PresenterNotes,
  clipIds: readonly string[],
): PresenterNotes | undefined {
  const clips: Record<string, string> = {};
  for (const id of clipIds) {
    const note = noteFor(notes, id);
    if (note) clips[id] = note;
  }
  const collection = notes.collection || null;
  if (collection === null && Object.keys(clips).length === 0) return undefined;
  return { collection, clips };
}

/** The notes to show while the clip `clipId` at `index` is up. */
export function presenterNotesView(
  notes: PresenterNotes,
  clipId: string,
  index: number,
): PresenterNotesView {
  return {
    collection: index === 0 ? notes.collection : null,
    clip: noteFor(notes, clipId),
  };
}

function noteFor(notes: PresenterNotes, clipId: string): string | null {
  return Object.hasOwn(notes.clips, clipId)
    ? (notes.clips[clipId] ?? null)
    : null;
}
