import { describe, expect, it, vi } from "vitest";

import {
  processClip,
  runForever,
  runOnce,
  type ClipCutterFn,
  type ClipJob,
  type ClipQueue,
  type ClipRunnerDeps,
} from "@/features/clips/cut";

const CLIP_ID = "11111111-1111-4111-8111-111111111111";

/** Two 60s chapters, so a window can be made to cross the seam. */
const sources = [
  { orderIndex: 0, filePath: "game/q1.mp4", durationS: 60 },
  { orderIndex: 1, filePath: "game/q2.mp4", durationS: 60 },
];

function job(overrides: Partial<ClipJob> = {}): ClipJob {
  return {
    clipId: CLIP_ID,
    tagId: "22222222-2222-4222-8222-222222222222",
    tagType: "goal",
    startS: 10,
    endS: 25,
    sources,
    previousOutputPath: null,
    ...overrides,
  };
}

/**
 * A queue over `jobs`. With `requeuedMidCut`, every claimed clip reads as
 * edited while cutting: the row is `pending` again, so both reports are no-ops.
 */
function fakeQueue(
  jobs: ClipJob[] = [],
  { requeuedMidCut = false }: { requeuedMidCut?: boolean } = {},
): ClipQueue & {
  ready: [string, string][];
  failed: string[];
} {
  const ready: [string, string][] = [];
  const failed: string[] = [];
  return {
    ready,
    failed,
    claimNext: async () => jobs.shift() ?? null,
    markReady: async (clipId, outputPath) => {
      if (requeuedMidCut) return false;
      ready.push([clipId, outputPath]);
      return true;
    },
    markFailed: async (clipId) => {
      if (requeuedMidCut) return false;
      failed.push(clipId);
      return true;
    },
  };
}

const silentLog = { info: () => {}, error: () => {} };

function deps(
  queue: ClipQueue,
  cut: ClipRunnerDeps["cut"] = async () => {},
  removed: string[] = [],
): ClipRunnerDeps {
  return {
    queue,
    cut,
    outputPathFor: (clipId) => `clips/${clipId}.mp4`,
    resolveOutput: (relativePath) => `/srv/media/${relativePath}`,
    removeOutput: async (relativePath) => {
      removed.push(relativePath);
    },
    log: silentLog,
  };
}

describe("processClip", () => {
  it("cuts the planned window and stores the media-relative path", async () => {
    const queue = fakeQueue();
    const cut = vi.fn<ClipCutterFn>(async () => {});

    await expect(processClip(deps(queue, cut), job())).resolves.toBe(true);

    expect(cut).toHaveBeenCalledOnce();
    const [plan, outputPath] = cut.mock.calls[0]!;
    expect(outputPath).toBe(`/srv/media/clips/${CLIP_ID}.mp4`);
    expect(plan.cuts).toEqual([
      {
        sourceIndex: 0,
        filePath: "game/q1.mp4",
        localStartS: 10,
        localEndS: 25,
        durationS: 15,
      },
    ]);
    // The row carries the path relative to the media root, so the app resolves
    // it under MEDIA_BASE_URL like any chapter file.
    expect(queue.ready).toEqual([[CLIP_ID, `clips/${CLIP_ID}.mp4`]]);
    expect(queue.failed).toEqual([]);
  });

  it("splits a window that crosses a chapter seam into one cut per file", async () => {
    const queue = fakeQueue();
    const cut = vi.fn<ClipCutterFn>(async () => {});

    await processClip(deps(queue, cut), job({ startS: 55, endS: 65 }));

    const [plan] = cut.mock.calls[0]!;
    expect(plan.spansBoundary).toBe(true);
    expect(plan.cuts.map((piece) => piece.filePath)).toEqual([
      "game/q1.mp4",
      "game/q2.mp4",
    ]);
  });

  it("derives the window from the tag type when the tag has no end", async () => {
    const queue = fakeQueue();
    const cut = vi.fn<ClipCutterFn>(async () => {});

    await processClip(deps(queue, cut), job({ endS: null }));

    // `goal` is configured with postS = 5.
    expect(cut.mock.calls[0]![0].durationS).toBe(5);
  });

  it("marks the clip failed when the cut fails, without a path", async () => {
    const queue = fakeQueue();
    const cut = vi.fn<ClipCutterFn>(async () => {
      throw new Error("ffmpeg exploded");
    });

    await expect(processClip(deps(queue, cut), job())).resolves.toBe(false);

    expect(queue.failed).toEqual([CLIP_ID]);
    expect(queue.ready).toEqual([]);
  });

  it("marks the clip failed when the window cannot be planned", async () => {
    const queue = fakeQueue();
    const cut = vi.fn<ClipCutterFn>(async () => {});

    // The game is 120s long; a window past its end has no chapter to cut from.
    await expect(
      processClip(deps(queue, cut), job({ startS: 200, endS: 210 })),
    ).resolves.toBe(false);

    expect(cut).not.toHaveBeenCalled();
    expect(queue.failed).toEqual([CLIP_ID]);
  });

  it("does not remove anything on a first cut", async () => {
    const removed: string[] = [];

    await processClip(deps(fakeQueue(), undefined, removed), job());

    expect(removed).toEqual([]);
  });

  it("removes the previous cut's file once a re-cut is ready", async () => {
    const queue = fakeQueue();
    const removed: string[] = [];

    await expect(
      processClip(
        deps(queue, undefined, removed),
        job({ previousOutputPath: "clips/old.mp4" }),
      ),
    ).resolves.toBe(true);

    expect(queue.ready).toEqual([[CLIP_ID, `clips/${CLIP_ID}.mp4`]]);
    expect(removed).toEqual(["clips/old.mp4"]);
  });

  it("drops a cut whose tag was edited mid-cut and keeps the served file", async () => {
    const queue = fakeQueue([], { requeuedMidCut: true });
    const removed: string[] = [];

    await expect(
      processClip(
        deps(queue, undefined, removed),
        job({ previousOutputPath: "clips/old.mp4" }),
      ),
    ).resolves.toBe(false);

    // The stale cut is thrown away; the row still points at the old file until
    // the next claim cuts the edited window.
    expect(removed).toEqual([`clips/${CLIP_ID}.mp4`]);
    expect(queue.ready).toEqual([]);
    expect(queue.failed).toEqual([]);
  });

  it("removes both the partial output and the previous file when a re-cut fails", async () => {
    const queue = fakeQueue();
    const removed: string[] = [];
    const cut = vi.fn<ClipCutterFn>(async () => {
      throw new Error("ffmpeg exploded");
    });

    await processClip(
      deps(queue, cut, removed),
      job({ previousOutputPath: "clips/old.mp4" }),
    );

    expect(queue.failed).toEqual([CLIP_ID]);
    expect(removed).toEqual([`clips/${CLIP_ID}.mp4`, "clips/old.mp4"]);
  });

  it("keeps the previous file when a failed cut was already re-queued", async () => {
    const removed: string[] = [];
    const cut = vi.fn<ClipCutterFn>(async () => {
      throw new Error("ffmpeg exploded");
    });

    await processClip(
      deps(fakeQueue([], { requeuedMidCut: true }), cut, removed),
      job({ previousOutputPath: "clips/old.mp4" }),
    );

    expect(removed).toEqual([`clips/${CLIP_ID}.mp4`]);
  });

  it("still reports the clip ready when removing the old file fails", async () => {
    const queue = fakeQueue();
    const base = deps(queue);

    await expect(
      processClip(
        {
          ...base,
          removeOutput: async () => {
            throw new Error("EACCES");
          },
        },
        job({ previousOutputPath: "clips/old.mp4" }),
      ),
    ).resolves.toBe(true);

    expect(queue.ready).toHaveLength(1);
  });
});

describe("runOnce", () => {
  it("reports an empty queue so the loop can back off", async () => {
    await expect(runOnce(deps(fakeQueue()))).resolves.toBe(false);
  });

  it("reports a claimed clip", async () => {
    await expect(runOnce(deps(fakeQueue([job()])))).resolves.toBe(true);
  });
});

describe("runForever", () => {
  it("drains queued clips back-to-back and only sleeps when empty", async () => {
    const queue = fakeQueue([job(), job({ clipId: "second" })]);
    const controller = new AbortController();
    const sleep = vi.fn(async () => {
      // Stop once the worker has drained the queue and gone idle.
      controller.abort();
    });

    await runForever(deps(queue), {
      pollIntervalMs: 5000,
      signal: controller.signal,
      sleep,
    });

    expect(queue.ready.map(([clipId]) => clipId)).toEqual([CLIP_ID, "second"]);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("does not claim anything once the signal is already aborted", async () => {
    const queue = fakeQueue([job()]);
    const controller = new AbortController();
    controller.abort();

    await runForever(deps(queue), {
      pollIntervalMs: 5000,
      signal: controller.signal,
      sleep: async () => {},
    });

    expect(queue.ready).toEqual([]);
  });
});
