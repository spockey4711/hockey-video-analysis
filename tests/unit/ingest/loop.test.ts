import { describe, expect, it } from "vitest";

import { runLoop } from "@/features/ingest";

describe("runLoop", () => {
  it("repeats a busy step at once and sleeps after an idle one", async () => {
    const controller = new AbortController();
    const results = [true, true, false, true];
    const events: string[] = [];

    await runLoop(
      async () => {
        const busy = results.shift();
        events.push(`step ${String(busy)}`);
        if (results.length === 0) controller.abort();
        return busy ?? false;
      },
      {
        intervalMs: 1000,
        signal: controller.signal,
        onError: () => events.push("error"),
        sleep: async (ms) => {
          events.push(`sleep ${ms}`);
        },
      },
    );

    expect(events).toEqual([
      "step true",
      "step true",
      "step false",
      "sleep 1000",
      "step true",
    ]);
  });

  it("reports a failed step, sleeps, and keeps going", async () => {
    const controller = new AbortController();
    const errors: unknown[] = [];
    let calls = 0;
    const failure = new Error("EIO: i/o error, scandir '/media/source'");

    await runLoop(
      async () => {
        calls += 1;
        if (calls === 1) throw failure;
        controller.abort();
        return false;
      },
      {
        intervalMs: 1000,
        signal: controller.signal,
        onError: (error) => errors.push(error),
        sleep: async () => {},
      },
    );

    expect(calls).toBe(2);
    expect(errors).toEqual([failure]);
  });

  it("does not report the error a shutdown causes", async () => {
    const controller = new AbortController();
    const errors: unknown[] = [];

    await runLoop(
      async () => {
        controller.abort();
        throw new Error("aborted");
      },
      {
        intervalMs: 1000,
        signal: controller.signal,
        onError: (error) => errors.push(error),
      },
    );

    expect(errors).toEqual([]);
  });
});
