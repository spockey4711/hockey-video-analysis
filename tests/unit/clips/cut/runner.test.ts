import { describe, expect, it, vi } from "vitest";

import {
  backfillOnce,
  processClip,
  runForever,
  runOnce,
  type ClipCutterFn,
  type ClipJob,
  type ClipQueue,
  type ClipRunnerDeps,
  type CutStartProbeFn,
  type UnprobedClip,
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

function unprobed(overrides: Partial<UnprobedClip> = {}): UnprobedClip {
  return {
    clipId: CLIP_ID,
    tagType: "goal",
    startS: 70,
    endS: 82,
    sources,
    outputPath: "clips/old.mp4",
    ...overrides,
  };
}

/**
 * A queue over `jobs` and the ready-but-unprobed clips in `unprobedClips`.
 * With `requeuedMidCut`, every claimed clip reads as edited while cutting: the
 * row is `pending` again, so both reports are no-ops.
 */
function fakeQueue(
  jobs: ClipJob[] = [],
  {
    requeuedMidCut = false,
    unprobedClips = [],
  }: { requeuedMidCut?: boolean; unprobedClips?: UnprobedClip[] } = {},
): ClipQueue & {
  ready: [string, string][];
  cutStarts: (number | null)[];
  failed: string[];
  recorded: [string, string, number][];
} {
  const ready: [string, string][] = [];
  const cutStarts: (number | null)[] = [];
  const failed: string[] = [];
  const recorded: [string, string, number][] = [];
  return {
    ready,
    cutStarts,
    failed,
    recorded,
    claimNext: async () => jobs.shift() ?? null,
    markReady: async (clipId, outputPath, cutStartS) => {
      if (requeuedMidCut) return false;
      ready.push([clipId, outputPath]);
      cutStarts.push(cutStartS);
      return true;
    },
    markFailed: async (clipId) => {
      if (requeuedMidCut) return false;
      failed.push(clipId);
      return true;
    },
    nextUnprobed: async (skipIds) => {
      const index = unprobedClips.findIndex(
        (clip) => !skipIds.includes(clip.clipId),
      );
      return index < 0 ? null : unprobedClips.splice(index, 1)[0]!;
    },
    recordCutStart: async (clipId, outputPath, cutStartS) => {
      recorded.push([clipId, outputPath, cutStartS]);
      return true;
    },
  };
}

const silentLog = { info: () => {}, error: () => {} };

/** The probe of a file cut 1.25s before its plan's start. */
const probeCutStart = vi.fn<CutStartProbeFn>(
  async (plan) => plan.startS - 1.25,
);

function deps(
  queue: ClipQueue,
  cut: ClipRunnerDeps["cut"] = async () => {},
  removed: string[] = [],
): ClipRunnerDeps {
  return {
    queue,
    cut,
    probeCutStart,
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

  it("records where the written file really starts", async () => {
    const queue = fakeQueue();
    probeCutStart.mockClear();

    await processClip(deps(queue), job());

    expect(probeCutStart).toHaveBeenCalledWith(
      expect.objectContaining({ startS: 10, endS: 25 }),
      `/srv/media/clips/${CLIP_ID}.mp4`,
    );
    expect(queue.cutStarts).toEqual([8.75]);
  });

  it("still reports the clip ready, start unknown, when the probe fails", async () => {
    const queue = fakeQueue();
    probeCutStart.mockRejectedValueOnce(new Error("ffprobe exploded"));

    await expect(processClip(deps(queue), job())).resolves.toBe(true);

    expect(queue.ready).toEqual([[CLIP_ID, `clips/${CLIP_ID}.mp4`]]);
    expect(queue.cutStarts).toEqual([null]);
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

describe("backfillOnce", () => {
  it("reports when every ready clip is probed", async () => {
    await expect(backfillOnce(deps(fakeQueue()), new Set())).resolves.toBe(
      false,
    );
  });

  it("probes an older clip's existing file and records its start, without cutting", async () => {
    const queue = fakeQueue([], { unprobedClips: [unprobed()] });
    const cut = vi.fn<ClipCutterFn>(async () => {});
    probeCutStart.mockClear();

    await expect(backfillOnce(deps(queue, cut), new Set())).resolves.toBe(true);

    expect(cut).not.toHaveBeenCalled();
    // The window crosses into the second chapter, so the plan starts there.
    const [plan, outputPath] = probeCutStart.mock.calls[0]!;
    expect(plan.cuts[0]).toMatchObject({ sourceIndex: 1, localStartS: 10 });
    expect(outputPath).toBe("/srv/media/clips/old.mp4");
    expect(queue.recorded).toEqual([[CLIP_ID, "clips/old.mp4", 68.75]]);
  });

  it("skips a clip whose probe fails until the worker restarts", async () => {
    const queue = fakeQueue([], {
      unprobedClips: [unprobed(), unprobed({ clipId: "second" })],
    });
    const skipped = new Set<string>();
    probeCutStart.mockRejectedValueOnce(new Error("unreadable"));

    await backfillOnce(deps(queue), skipped);
    await backfillOnce(deps(queue), skipped);

    expect(skipped).toEqual(new Set([CLIP_ID]));
    expect(queue.recorded.map(([clipId]) => clipId)).toEqual(["second"]);
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

  it("backfills only while the queue is empty, and sleeps once both are done", async () => {
    const jobs = [job({ clipId: "queued" })];
    const queue = fakeQueue(jobs, {
      unprobedClips: [
        unprobed({ clipId: "old-1" }),
        unprobed({ clipId: "old-2" }),
      ],
    });
    const order: string[] = [];
    const base = deps(queue);
    const controller = new AbortController();
    const sleep = vi.fn(async () => {
      controller.abort();
    });

    await runForever(
      {
        ...base,
        cut: async (plan) => {
          order.push(`cut ${plan.startS}`);
        },
        probeCutStart: async (plan, outputPath) => {
          order.push(`probe ${outputPath}`);
          // A cut enqueued while the backfill runs is taken before the next probe.
          if (outputPath.endsWith("old.mp4") && order.length === 3) {
            jobs.push(job({ clipId: "late", startS: 40, endS: 50 }));
          }
          return plan.startS;
        },
      },
      { pollIntervalMs: 5000, signal: controller.signal, sleep },
    );

    expect(order).toEqual([
      "cut 10",
      "probe /srv/media/clips/queued.mp4",
      "probe /srv/media/clips/old.mp4",
      "cut 40",
      "probe /srv/media/clips/late.mp4",
      "probe /srv/media/clips/old.mp4",
    ]);
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
