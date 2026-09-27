import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClipUploadError,
  expectedUploadDuration,
  FINISHED_UPLOAD_RETAIN_MS,
  moveFile,
  processUpload,
  runForever,
  sweepUploads,
  type ClipQueue,
  type ClipRunnerDeps,
  type ClipUploadCheckFn,
  type UploadJob,
  type UploadQueue,
  type UploadRunnerDeps,
} from "@/features/clips/cut";
import {
  createStagingFile,
  listStagedUploads,
  stagingFilePath,
} from "@/features/uploads/staging";
import { DEFAULT_TAG_WINDOWS } from "@/lib/tag-types";

// The clip worker's share of the Mac's uploads (Mac plan S5) against a fake
// queue and a real staging directory: what the file is checked against, where
// it lands, which files go, and when the idle loop sweeps.
const CLIP_ID = "11111111-1111-4111-8111-111111111111";
const UPLOAD_ID = "8a1f2e3d-4c5b-4a69-8778-695a4b3c2d1e";
const STRAY_ID = "9b2e3f4a-5d6c-4b7a-8988-7a6b5c4d3e2f";

/** Two 60s chapters, so a window can be made to cross the seam. */
const sources = [
  { orderIndex: 0, filePath: "game/q1.mp4", durationS: 60 },
  { orderIndex: 1, filePath: "game/q2.mp4", durationS: 60 },
];

function job(overrides: Partial<UploadJob> = {}): UploadJob {
  return {
    uploadId: UPLOAD_ID,
    clipId: CLIP_ID,
    sizeBytes: 2048,
    cutStartS: 9,
    tagType: "goal",
    startS: 10,
    endS: 25,
    windows: DEFAULT_TAG_WINDOWS,
    sources,
    ...overrides,
  };
}

/**
 * A queue whose `finish` and `refuse` answer `previous` (the clip's earlier
 * file, null for none, false when the clip no longer waits for the upload).
 */
function fakeQueue(
  jobs: UploadJob[] = [],
  previous: string | null | false = null,
  liveIds: string[] = [],
): UploadQueue & {
  finished: [string, string][];
  refused: string[];
  sweeps: [Date, number][];
} {
  const finished: [string, string][] = [];
  const refused: string[] = [];
  const sweeps: [Date, number][] = [];
  return {
    finished,
    refused,
    sweeps,
    nextSubmitted: async () => jobs.shift() ?? null,
    finish: async (next, outputPath) => {
      finished.push([next.uploadId, outputPath]);
      return previous;
    },
    refuse: async (next) => {
      refused.push(next.uploadId);
      return previous;
    },
    sweep: async (now, retainMs) => {
      sweeps.push([now, retainMs]);
      return { liveIds: new Set(liveIds), removed: 2, requeued: 1 };
    },
  };
}

const silentLog = { info: () => {}, error: () => {} };

const emptyClipQueue: ClipQueue = {
  claimNext: async () => null,
  markReady: async () => true,
  markFailed: async () => true,
  nextUnprobed: async () => null,
  recordCutStart: async () => true,
};

let staging: string;
let removed: string[];
let moved: [string, string][];

function shared(): Pick<
  ClipRunnerDeps,
  "outputPathFor" | "resolveOutput" | "removeOutput" | "log"
> {
  return {
    outputPathFor: (clipId) => `clips/${clipId}-new.mp4`,
    resolveOutput: (relativePath) => `/srv/media/${relativePath}`,
    removeOutput: async (relativePath) => {
      removed.push(relativePath);
    },
    log: silentLog,
  };
}

function uploads(
  queue: UploadQueue,
  check: ClipUploadCheckFn = async () => {},
): UploadRunnerDeps {
  return {
    queue,
    stagingRoot: staging,
    check,
    move: async (from, to) => {
      moved.push([from, to]);
    },
  };
}

beforeEach(async () => {
  staging = await mkdtemp(path.join(tmpdir(), "upload-runner-"));
  removed = [];
  moved = [];
  await createStagingFile(staging, UPLOAD_ID);
});

afterEach(async () => {
  await rm(staging, { recursive: true, force: true });
});

describe("expectedUploadDuration", () => {
  it("is the lead before the tag plus the tag's cut plan", () => {
    expect(expectedUploadDuration(job())).toBeCloseTo(16);
  });

  it("follows the cut plan across a chapter seam", () => {
    expect(
      expectedUploadDuration(job({ startS: 55, endS: 70, cutStartS: 54 })),
    ).toBeCloseTo(16);
  });

  it("takes a tag without an end from the team's tag window", () => {
    const open = job({ endS: null, cutStartS: 10 });
    expect(expectedUploadDuration(open)).toBeCloseTo(
      DEFAULT_TAG_WINDOWS.goal!.postS,
    );
  });

  it("refuses a file start after the tag or none at all", () => {
    expect(() => expectedUploadDuration(job({ cutStartS: 11 }))).toThrow(
      RangeError,
    );
    expect(() =>
      expectedUploadDuration(job({ cutStartS: Number.NaN })),
    ).toThrow(RangeError);
  });
});

describe("processUpload", () => {
  it("checks the staged file, moves it into place and marks the clip ready", async () => {
    const queue = fakeQueue([], "clips/old.mp4");
    const check = vi.fn<ClipUploadCheckFn>(async () => {});

    await expect(
      processUpload(shared(), uploads(queue, check), job()),
    ).resolves.toBe(true);

    const staged = stagingFilePath(staging, UPLOAD_ID);
    expect(check).toHaveBeenCalledWith(staged, {
      sizeBytes: 2048,
      durationS: expect.closeTo(16, 6) as number,
    });
    expect(moved).toEqual([[staged, `/srv/media/clips/${CLIP_ID}-new.mp4`]]);
    expect(queue.finished).toEqual([[UPLOAD_ID, `clips/${CLIP_ID}-new.mp4`]]);
    // The file the clip pointed at before is removed; the new one stays.
    expect(removed).toEqual(["clips/old.mp4"]);
  });

  it("fails the clip and removes every file of a refused upload", async () => {
    const queue = fakeQueue([], "clips/old.mp4");
    const check = vi.fn<ClipUploadCheckFn>(async () => {
      throw new ClipUploadError("no video stream");
    });

    await expect(
      processUpload(shared(), uploads(queue, check), job()),
    ).resolves.toBe(false);

    expect(queue.refused).toEqual([UPLOAD_ID]);
    expect(queue.finished).toEqual([]);
    expect(moved).toEqual([]);
    await expect(listStagedUploads(staging)).resolves.toEqual([]);
    expect(removed).toEqual([`clips/${CLIP_ID}-new.mp4`, "clips/old.mp4"]);
  });

  it("refuses a file whose start does not fit the tag without checking it", async () => {
    const queue = fakeQueue();
    const check = vi.fn<ClipUploadCheckFn>(async () => {});

    await expect(
      processUpload(
        shared(),
        uploads(queue, check),
        job({ cutStartS: Number.NaN }),
      ),
    ).resolves.toBe(false);

    expect(check).not.toHaveBeenCalled();
    expect(queue.refused).toEqual([UPLOAD_ID]);
  });

  it("keeps the clip's file when a newer hand-off took over", async () => {
    const queue = fakeQueue([], false);

    await expect(
      processUpload(
        shared(),
        uploads(queue, async () => {
          throw new ClipUploadError("does not start like an MP4 file");
        }),
        job(),
      ),
    ).resolves.toBe(false);

    expect(removed).toEqual([`clips/${CLIP_ID}-new.mp4`]);
  });

  it("drops the moved file when the tag changed in the meantime", async () => {
    const queue = fakeQueue([], false);

    await expect(processUpload(shared(), uploads(queue), job())).resolves.toBe(
      false,
    );

    expect(moved).toHaveLength(1);
    expect(removed).toEqual([`clips/${CLIP_ID}-new.mp4`]);
  });
});

describe("sweepUploads", () => {
  it("removes staged files no live upload owns, and nothing else", async () => {
    await createStagingFile(staging, STRAY_ID);
    await writeFile(path.join(staging, "notes.txt"), "keep");
    const queue = fakeQueue([], null, [UPLOAD_ID]);
    const now = new Date("2026-09-27T10:00:00Z");

    await sweepUploads(shared(), uploads(queue), now);

    expect(queue.sweeps).toEqual([[now, FINISHED_UPLOAD_RETAIN_MS]]);
    await expect(listStagedUploads(staging)).resolves.toEqual([UPLOAD_ID]);
    await expect(
      readFile(path.join(staging, "notes.txt"), "utf8"),
    ).resolves.toBe("keep");
  });

  it("copes with a staging directory that does not exist yet", async () => {
    const queue = fakeQueue();
    await sweepUploads(
      shared(),
      { ...uploads(queue), stagingRoot: path.join(staging, "missing") },
      new Date(),
    );
    expect(queue.sweeps).toHaveLength(1);
  });
});

describe("moveFile", () => {
  it("moves a file into a directory it creates", async () => {
    const from = stagingFilePath(staging, UPLOAD_ID);
    await writeFile(from, "clip bytes");
    const to = path.join(staging, "media", "clips", "a.mp4");
    await mkdir(path.dirname(path.dirname(to)), { recursive: true });

    await moveFile(from, to);

    await expect(readFile(to, "utf8")).resolves.toBe("clip bytes");
    await expect(listStagedUploads(staging)).resolves.toEqual([]);
  });
});

describe("runForever with uploads", () => {
  function runnerDeps(queue: UploadQueue): ClipRunnerDeps {
    return {
      ...shared(),
      queue: emptyClipQueue,
      cut: async () => {},
      probeCutStart: async (plan) => plan.startS,
      uploads: uploads(queue),
    };
  }

  it("serves handed-off uploads back-to-back, then sweeps and sleeps", async () => {
    const queue = fakeQueue([job(), job({ uploadId: STRAY_ID })]);
    const controller = new AbortController();
    const sleep = vi.fn(async () => {
      controller.abort();
    });

    await runForever(runnerDeps(queue), {
      pollIntervalMs: 5000,
      signal: controller.signal,
      sleep,
    });

    expect(queue.finished.map(([uploadId]) => uploadId)).toEqual([
      UPLOAD_ID,
      STRAY_ID,
    ]);
    expect(queue.sweeps).toHaveLength(1);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("sweeps at most once per sweep interval", async () => {
    const queue = fakeQueue();
    const controller = new AbortController();
    let time = Date.parse("2026-09-27T10:00:00Z");
    let sleeps = 0;

    await runForever(runnerDeps(queue), {
      pollIntervalMs: 60_000,
      sweepIntervalMs: 10 * 60_000,
      signal: controller.signal,
      now: () => new Date(time),
      sleep: async (ms) => {
        time += ms;
        sleeps += 1;
        if (sleeps === 25) controller.abort();
      },
    });

    // 25 idle minutes: a sweep at 0, 10 and 20.
    expect(queue.sweeps).toHaveLength(3);
  });
});
