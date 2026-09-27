/**
 * The caption of the step on show, laid over the bottom of a read-only board
 * (the scene's stage on the collection link and in presentation mode, the
 * board on the audience window) like a subtitle: centred on the video scrim
 * and sized to the board it sits on. On a board of a laptop or projector it
 * stays narrow enough to clear the play lines' legend in the bottom-left
 * corner; on a phone it may run wider, so it wraps less over the players.
 * No caption shows nothing.
 */
export function StageCaption({ caption }: { caption: string }) {
  if (!caption) return null;
  return (
    <div className="[container-type:size] pointer-events-none absolute inset-0">
      <p
        aria-live="polite"
        className="absolute bottom-[0.8em] left-1/2 w-max max-w-[84%] -translate-x-1/2 rounded-[var(--radius-sm)] bg-[var(--video-scrim)] px-[0.6em] py-[0.2em] text-center text-[length:clamp(11px,2.2cqw,32px)] leading-snug [text-wrap:balance] break-words text-[color:var(--video-ink)] @min-[600px]:max-w-[64%]"
      >
        {caption}
      </p>
    </div>
  );
}
