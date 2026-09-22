"use client";

/**
 * The only chrome left on the video stage while it fills the screen (P2-16):
 * an exit button and the tag-capture bar, both fading away once the coach stops
 * moving the pointer so the bare frame is what remains. Any pointer move or key
 * press brings them back - which means a tag hotkey reveals the bar together
 * with the capture confirmation the buttons render, so a capture is always
 * visibly acknowledged even though the tags rail is off screen.
 *
 * Everything else (the game clock, the paused badge) stays with
 * {@link PlayerVideoFrame}: it is small, always wanted, and never in the way.
 */
import { useEffect, useState, type ReactNode } from "react";

import { playerContent } from "./content";

import { cn } from "@/components/core/cn";
import { IconButton } from "@/components/forms/IconButton";

/** How long the chrome stays up after the last pointer move or key press. */
const IDLE_MS = 2500;

export interface FullscreenStageChromeProps {
  /** Leave fullscreen (Escape does the same through the browser). */
  readonly onExit: () => void;
  /** The tag-capture buttons, on loan from the transport bar for the duration. */
  readonly tagControls?: ReactNode;
}

/**
 * Whether the chrome should currently be shown: true right after any pointer or
 * keyboard activity, false again after {@link IDLE_MS} of stillness. Re-rendering
 * is cheap because setting the same value bails out of the render.
 */
function useIdleReveal(): boolean {
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    let timer = window.setTimeout(() => setRevealed(false), IDLE_MS);

    function reveal(): void {
      setRevealed(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRevealed(false), IDLE_MS);
    }

    window.addEventListener("pointermove", reveal);
    window.addEventListener("pointerdown", reveal);
    window.addEventListener("keydown", reveal);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", reveal);
      window.removeEventListener("pointerdown", reveal);
      window.removeEventListener("keydown", reveal);
    };
  }, []);

  return revealed;
}

export function FullscreenStageChrome({
  onExit,
  tagControls,
}: FullscreenStageChromeProps) {
  const revealed = useIdleReveal();
  const { fullscreen } = playerContent;

  return (
    <>
      {/* While the chrome is hidden, this catcher owns the pointer so the mouse
          cursor disappears over the frame; the first move brings both back. */}
      {!revealed ? (
        <div aria-hidden className="absolute inset-0 cursor-none" />
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-between p-[var(--space-4)] transition-opacity duration-[var(--dur-slow)] ease-[var(--ease-out)]",
          revealed ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex items-start">
          <IconButton
            name="minimize"
            label={fullscreen.exit}
            variant="solid"
            onClick={onExit}
            className={cn(
              "border-transparent bg-[var(--video-scrim)] text-[color:var(--video-ink)] backdrop-blur-sm hover:bg-[var(--video-scrim)] hover:brightness-125",
              revealed && "pointer-events-auto",
            )}
          />
        </div>

        {/* No bar behind the controls: each one carries its own scrim pill, so
            the HUD floats over the frame instead of boxing it in. */}
        {tagControls ? (
          <div
            className={cn(
              "mx-auto flex items-center",
              revealed && "pointer-events-auto",
            )}
          >
            {tagControls}
          </div>
        ) : null}
      </div>
    </>
  );
}
