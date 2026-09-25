import { presentationContent } from "./content";
import type { TitleCard } from "./title-cards";

import { Button } from "@/components/forms/Button";
import { TeamNote } from "@/features/share/playlist/TeamNote";

export interface TitleCardViewProps {
  readonly card: TitleCard;
  /** The title of the clip the card comes before, shown on a clip's card. */
  readonly clipTitle: string;
  /** Step past the card: to the next one, or to the clip. */
  readonly onContinue: () => void;
}

/**
 * One title card over the video in presentation mode: the coach's text for the
 * team, large enough to read off a projector, and a "Weiter" button. It covers
 * the whole video surface, so the clip behind it stays hidden until the viewer
 * moves on; a long text scrolls within the card.
 */
export function TitleCardView({
  card,
  clipTitle,
  onContinue,
}: TitleCardViewProps) {
  const copy = presentationContent.titleCard;
  const label = card.kind === "intro" ? copy.introLabel : copy.clipLabel;

  return (
    <div
      role="group"
      aria-label={label}
      className="absolute inset-0 flex overflow-y-auto bg-[var(--surface-raised)]"
    >
      <div className="m-auto flex w-full max-w-[60ch] flex-col items-start gap-[var(--space-6)] p-[var(--space-8)]">
        <div className="flex flex-col gap-[var(--space-3)]">
          <p className="text-[length:var(--fs-caption)] [font-weight:var(--fw-semibold)] tracking-[var(--ls-caps)] text-[color:var(--text-muted)] uppercase">
            {label}
          </p>
          {card.kind === "clip" && (
            <h2 className="text-[length:var(--fs-h2)] [font-weight:var(--fw-semibold)] text-[color:var(--text-primary)]">
              {clipTitle}
            </h2>
          )}
        </div>
        <TeamNote text={card.text} className="text-[length:var(--fs-h3)]" />
        <Button iconRight="chevron-right" onClick={onContinue}>
          {copy.continue}
        </Button>
      </div>
    </div>
  );
}
