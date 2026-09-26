"use client";

import {
  type RefObject,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
  type VideoHTMLAttributes,
} from "react";

import { preloadWindow } from "./preload-window";

/**
 * The part of a playlist entry {@link ClipVideo} needs to show and load it. An
 * entry without a `src` (a tactics scene on the collection link) is never
 * loaded ahead; the current entry always has one while the video shows.
 */
export interface ClipSource {
  readonly id: string;
  readonly src?: string;
}

export interface ClipVideoProps extends Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src" | "preload" | "onLoadedData"
> {
  /** The playlist's entries in order. */
  readonly items: readonly ClipSource[];
  /** The clip on screen; must be a valid index into `items`. */
  readonly index: number;
  /** Always points at the element showing the current clip. */
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * The current clip has its first frame, either freshly loaded or because it
   * already loaded ahead of time. Stands in for `onLoadedData`, which a clip
   * loaded ahead fired long before it came up.
   */
  readonly onReady?: () => void;
}

/** The part of the Network Information API this reads (not in every browser). */
interface ConnectionLike extends EventTarget {
  readonly saveData?: boolean;
}

function connection(): ConnectionLike | undefined {
  return (navigator as Navigator & { connection?: ConnectionLike }).connection;
}

function subscribeToConnection(onChange: () => void): () => void {
  const target = connection();
  target?.addEventListener("change", onChange);
  return () => target?.removeEventListener("change", onChange);
}

/**
 * Whether the viewer asked to save data, or `null` while rendering on the
 * server, where it is unknown and nothing loads ahead yet.
 */
function useSaveData(): boolean | null {
  return useSyncExternalStore(
    subscribeToConnection,
    () => connection()?.saveData === true,
    () => null,
  );
}

/**
 * The `<video>` of a share-link player that also loads the next clips ahead
 * (see {@link preloadWindow}). The current clip renders with the given props;
 * up to two clips after it sit in hidden elements with no handlers, so they
 * buffer without the viewer seeing, hearing or counting anything. Moving on to
 * one of them shows that same element, already buffered, instead of starting a
 * fresh load. Loading ahead waits until the current clip has its first frame so
 * it never slows the clip the viewer is waiting for.
 *
 * A clip that has been on screen is never reused once the viewer leaves it:
 * coming back gets a fresh element, exactly as if every clip had its own, so
 * playback position and view counting start over as before. Elements behind the
 * current clip are dropped, and all of them go with the player, so a long
 * playlist never holds more than three.
 */
export function ClipVideo({
  items,
  index,
  videoRef,
  onReady,
  children,
  ...currentProps
}: ClipVideoProps) {
  const saveData = useSaveData();
  // How often each clip has left the screen; part of its element's key, so a
  // clip that comes back gets a new element.
  const [shown, setShown] = useState({
    index,
    left: {} as Readonly<Record<string, number>>,
  });
  if (shown.index !== index) {
    const leaving = items[shown.index]?.id;
    setShown({
      index,
      left: leaving
        ? { ...shown.left, [leaving]: (shown.left[leaving] ?? 0) + 1 }
        : shown.left,
    });
  }
  const keyFor = (clip: ClipSource) => `${clip.id}:${shown.left[clip.id] ?? 0}`;

  const current = items[index];
  const currentKey = keyFor(current);
  // The current element whose first frame is in; loading ahead waits for it.
  const [readyKey, setReadyKey] = useState<string | null>(null);

  function markReady() {
    setReadyKey(currentKey);
    onReady?.();
  }
  const markReadyAsItComesUp = useEffectEvent(markReady);

  // A clip that loaded ahead fired `loadeddata` while hidden, so report it
  // ready as it comes up; one still loading reports through the event.
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      markReadyAsItComesUp();
    }
  }, [currentKey, videoRef]);

  const ahead =
    saveData === null || readyKey !== currentKey
      ? null
      : preloadWindow(index, items.length, saveData);

  // One flat keyed list, in playlist order with the current clip first, so an
  // element loaded ahead stays mounted, and in place, as it comes up.
  return [index, ...(ahead?.indices ?? [])].flatMap((clipIndex) => {
    const clip = items[clipIndex];
    const key = keyFor(clip);
    // A scene ahead has nothing to load.
    if (clipIndex !== index && clip.src === undefined) return [];
    if (clipIndex === index) {
      return (
        <video
          key={key}
          ref={videoRef}
          src={clip.src}
          preload="auto"
          onLoadedData={markReady}
          {...currentProps}
        >
          {children}
        </video>
      );
    }
    return (
      <video
        key={key}
        src={clip.src}
        preload={ahead?.preload}
        playsInline
        aria-hidden
        tabIndex={-1}
        className="hidden"
      />
    );
  });
}
