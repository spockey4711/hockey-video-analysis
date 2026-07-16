"use client";

/**
 * Scan-speed control for the watch transport (P2-7): a compact button that
 * cycles the player through 1x -> 2x -> 4x so the coach can fast-scan for a
 * moment. Reads and drives the shared {@link PlayerController}; the keyboard
 * up/down keys change the same rate (see {@link useTransportHotkeys}).
 */
import { usePlayerController } from "./PlayerContext";
import { playerContent } from "./content";
import { formatPlaybackRate, nextPlaybackRate } from "./playback-rate";

export function PlaybackRateControl() {
  const { playbackRate, setPlaybackRate } = usePlayerController();
  const current = formatPlaybackRate(playbackRate);
  const upcoming = formatPlaybackRate(nextPlaybackRate(playbackRate));
  const isScanning = playbackRate !== 1;

  return (
    <button
      type="button"
      // Announce the speed it switches to, matching the icon-button pattern of
      // labelling the action rather than the current state.
      aria-label={playerContent.transport.speed(upcoming)}
      title={playerContent.transport.speed(upcoming)}
      aria-pressed={isScanning}
      onClick={() => setPlaybackRate(nextPlaybackRate(playbackRate))}
      className={`inline-flex h-[var(--control-md)] min-w-[var(--control-md)] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-2)] font-[family-name:var(--font-mono)] text-[length:var(--fs-body-sm)] tabular-nums transition duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none ${
        isScanning
          ? "bg-[var(--surface-hover)] text-[color:var(--text-brand)]"
          : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]"
      }`}
    >
      {current}
    </button>
  );
}
