/**
 * Read a chapter file's length in the browser from its media metadata, so the
 * create-game form never asks the coach to type seconds.
 *
 * It loads the file through the same URL the tagging player will use, with
 * `preload="metadata"`: the browser fetches only the container header (a few
 * range requests, even for a multi-GB file), never the video itself. A file the
 * player could not load fails here too, which doubles as a path check.
 */

/** Raised when the file cannot be loaded or reports no usable length. */
export class MediaDurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaDurationError";
  }
}

/**
 * Resolve with the length in seconds of the media at `url`.
 *
 * Rejects with {@link MediaDurationError} when the file does not load or has no
 * finite positive duration (a live stream reports `Infinity`), and with the
 * signal's reason when `signal` aborts first. The element is released in every
 * case so an abandoned probe does not keep a connection open.
 */
export function readMediaDuration(
  url: string,
  signal: AbortSignal,
  createVideo: () => HTMLVideoElement = () => document.createElement("video"),
): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const video = createVideo();

    const release = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
      // Dropping the source and reloading is what makes the browser close the
      // pending request; merely discarding the element does not.
      video.removeAttribute("src");
      video.load();
    };

    function onLoaded() {
      const { duration } = video;
      release();
      if (Number.isFinite(duration) && duration > 0) {
        resolve(duration);
      } else {
        reject(new MediaDurationError(`no usable duration: ${duration}`));
      }
    }

    function onError() {
      release();
      reject(new MediaDurationError(`could not load media: ${url}`));
    }

    function onAbort() {
      release();
      reject(signal.reason);
    }

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort);
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
  });
}
