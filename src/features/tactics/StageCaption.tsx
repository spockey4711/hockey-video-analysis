/**
 * The caption of the step on show, laid over the bottom of a read-only board
 * (the scene's stage on the collection link and in presentation mode, the
 * board on the audience window) like a subtitle: centred on the video scrim,
 * narrow enough to clear the play lines' legend in the bottom-left corner,
 * and sized to the board it sits on. No caption shows nothing.
 */
export function StageCaption({ caption }: { caption: string }) {
  if (!caption) return null;
  return (
    <div className="[container-type:size] pointer-events-none absolute inset-0">
      <p
        aria-live="polite"
        className="absolute bottom-[1em] left-1/2 w-max max-w-[64%] -translate-x-1/2 rounded-[var(--radius-sm)] bg-[var(--video-scrim)] px-[0.7em] py-[0.25em] text-center text-[length:clamp(12px,2.2cqw,32px)] leading-snug [text-wrap:balance] break-words text-[color:var(--video-ink)]"
      >
        {caption}
      </p>
    </div>
  );
}
