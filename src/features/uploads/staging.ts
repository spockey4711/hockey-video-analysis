/**
 * The staging directory of the Mac app's uploads (Mac plan S5): where an
 * upload's bytes sit until the clip worker checks the file and moves it into
 * the served media. It lives outside the served media (`UPLOAD_STAGING_ROOT`),
 * so a half-uploaded or refused file is never reachable by a URL.
 *
 * A staged file is named only by its upload's server-made id, so no part of a
 * client's request ever becomes part of a path. Both the web app (which writes
 * the chunks) and the clip worker (which reads, moves and sweeps) use this
 * module; it holds no database access.
 */
import { mkdir, open, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { isUuid } from "@/features/clips/validation";

const STAGING_SUFFIX = ".part";

const STAGED_NAME =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.part$/;

/**
 * The staging directory from `UPLOAD_STAGING_ROOT`, resolved to an absolute
 * path, or null when it is unset and uploads are off.
 */
export function stagingRootFromEnv(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const root = env.UPLOAD_STAGING_ROOT?.trim();
  return root ? path.resolve(root) : null;
}

/** The staged file of an upload; throws for anything but an upload id. */
export function stagingFilePath(root: string, uploadId: string): string {
  if (!isUuid(uploadId)) throw new RangeError("not an upload id");
  return path.join(root, `${uploadId.toLowerCase()}${STAGING_SUFFIX}`);
}

/** The upload id a staged file name belongs to, or null for any other name. */
export function stagedUploadId(fileName: string): string | null {
  return STAGED_NAME.exec(fileName)?.[1] ?? null;
}

/** Create an upload's empty staged file (and the directory on first use). */
export async function createStagingFile(
  root: string,
  uploadId: string,
): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(stagingFilePath(root, uploadId), "", { flag: "wx" });
}

/** Remove an upload's staged file; a missing one is not an error. */
export async function removeStagingFile(
  root: string,
  uploadId: string,
): Promise<void> {
  await rm(stagingFilePath(root, uploadId), { force: true });
}

/** The upload ids of every staged file in `root`; other names are left out. */
export async function listStagedUploads(root: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(root);
  } catch (cause) {
    if (isMissing(cause)) return [];
    throw cause;
  }
  return names.flatMap((name) => stagedUploadId(name) ?? []);
}

/** What writing one chunk did. */
export interface ChunkWrite {
  /** How many bytes landed in the file, from the chunk's offset on. */
  readonly written: number;
  /** True when the body carried more than `maxBytes`; the rest was dropped. */
  readonly overflow: boolean;
  /** Set when the body broke off (the client went away) before its end. */
  readonly interrupted: boolean;
}

/**
 * Write a request body into a staged file from `offset` on, at most
 * `maxBytes` of it. Every byte goes to an explicit position, so a retried
 * chunk writes the same bytes to the same place and the file never grows past
 * the chunk's end. What landed before a broken-off body is reported, so the
 * upload resumes from there instead of from the chunk's start.
 */
export async function writeChunk(
  filePath: string,
  offset: number,
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<ChunkWrite> {
  if (body === null) return { written: 0, overflow: false, interrupted: false };
  const file = await open(filePath, "r+");
  const reader = body.getReader();
  let written = 0;
  let overflow = false;
  let interrupted = false;
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        interrupted = true;
        break;
      }
      if (chunk.done) break;
      const room = maxBytes - written;
      const bytes =
        chunk.value.byteLength > room
          ? chunk.value.subarray(0, room)
          : chunk.value;
      await writeFully(file, bytes, offset + written);
      written += bytes.byteLength;
      if (bytes !== chunk.value) {
        overflow = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } finally {
    reader.releaseLock();
    await file.close();
  }
  return { written, overflow, interrupted };
}

async function writeFully(
  file: Awaited<ReturnType<typeof open>>,
  bytes: Uint8Array,
  position: number,
): Promise<void> {
  let done = 0;
  while (done < bytes.byteLength) {
    const { bytesWritten } = await file.write(
      bytes,
      done,
      bytes.byteLength - done,
      position + done,
    );
    done += bytesWritten;
  }
}

/** The first `length` bytes of a file (fewer when it is shorter). */
export async function readFileHead(
  filePath: string,
  length: number,
): Promise<Uint8Array> {
  const file = await open(filePath, "r");
  try {
    const head = new Uint8Array(length);
    const { bytesRead } = await file.read(head, 0, length, 0);
    return head.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

/** How many leading bytes {@link hasMp4Signature} looks at. */
export const MP4_SIGNATURE_BYTES = 8;

/**
 * Whether a file's first bytes open an MP4: an ISO media file starts with its
 * `ftyp` box, whose type sits at bytes 4-8. A cheap type check that runs
 * before any tool parses the file.
 */
export function hasMp4Signature(head: Uint8Array): boolean {
  return (
    head.byteLength >= MP4_SIGNATURE_BYTES &&
    head[4] === 0x66 && // f
    head[5] === 0x74 && // t
    head[6] === 0x79 && // y
    head[7] === 0x70 // p
  );
}

function isMissing(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { code?: unknown }).code === "ENOENT"
  );
}
