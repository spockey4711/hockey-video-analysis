/**
 * The loop both halves of the ingest worker run in: do a step, and sleep only
 * when the step found nothing to do.
 *
 * A step that throws is logged and the loop sleeps and tries again: a Drive
 * outage (the mount answering with I/O errors) or a database restart must not
 * stop the worker, only pause it. The loop ends when `signal` aborts.
 */

export interface LoopOptions {
  /** How long to wait after an idle or failed step. */
  readonly intervalMs: number;
  readonly signal: AbortSignal;
  /** Reports a failed step; `console.error` in production. */
  readonly onError: (error: unknown) => void;
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Run `step` until `signal` aborts. `step` resolves true when it did work and
 * should run again right away, false when it is idle.
 */
export async function runLoop(
  step: () => Promise<boolean>,
  { intervalMs, signal, onError, sleep = abortableSleep }: LoopOptions,
): Promise<void> {
  while (!signal.aborted) {
    let busy = false;
    try {
      busy = await step();
    } catch (error) {
      if (signal.aborted) break;
      onError(error);
    }
    if (!busy) await sleep(intervalMs, signal);
  }
}
