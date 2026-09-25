/**
 * The title cards presentation mode shows before a clip plays: the coach's
 * notes for the team on the collection link, public to anyone with it (unlike
 * the private presenter notes). The collection intro comes before the first
 * clip, then a clip's own text before that clip. A clip without a text, on a
 * link without an intro, gets no card and plays exactly as before.
 */
export interface TitleCard {
  /** `intro` for the collection's intro, `clip` for the clip's own text. */
  readonly kind: "intro" | "clip";
  /** The coach's plain text, line breaks kept. */
  readonly text: string;
}

/**
 * The cards to step through, in order, before the clip at `index` plays. Each
 * one waits for the viewer (play or "Weiter"); none advances on its own.
 */
export function titleCardsFor(
  index: number,
  item: { readonly teamNote?: string },
  intro: string | undefined,
): readonly TitleCard[] {
  const cards: TitleCard[] = [];
  if (index === 0 && intro) cards.push({ kind: "intro", text: intro });
  if (item.teamNote) cards.push({ kind: "clip", text: item.teamNote });
  return cards;
}
