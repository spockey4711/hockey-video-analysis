/**
 * Listing the game folders under the source root (the read-only Drive mount).
 *
 * Every directory directly under the root is a candidate game folder; loose
 * files there (a PDF) and hidden entries are not. A folder's files are listed
 * with their sizes, and the sorted list doubles as a fingerprint: Drive only
 * shows a file once its upload has finished, so an upload in progress shows up
 * as a fingerprint that still changes.
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/** One file directly inside a game folder. */
export interface FolderFile {
  readonly name: string;
  readonly sizeBytes: number;
}

/** A candidate game folder as seen in one scan. */
export interface FolderSnapshot {
  /** The folder's name, which is also its path relative to the source root. */
  readonly name: string;
  readonly files: readonly FolderFile[];
  /** Changes whenever a file appears, disappears or changes size. */
  readonly fingerprint: string;
}

function isHidden(name: string): boolean {
  return name.startsWith(".");
}

/** One file as a line of a fingerprint: its name and size. */
export function fileKey(file: FolderFile): string {
  return `${file.name}\t${file.sizeBytes}`;
}

/** The fingerprint of a folder's file list, independent of listing order. */
export function fingerprintFiles(files: readonly FolderFile[]): string {
  return files.map(fileKey).sort().join("\n");
}

async function listFiles(folderPath: string): Promise<FolderFile[]> {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const files: FolderFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || isHidden(entry.name)) continue;
    const { size } = await stat(path.join(folderPath, entry.name));
    files.push({ name: entry.name, sizeBytes: size });
  }
  return files;
}

/** List every candidate game folder under `sourceRoot`, sorted by name. */
export async function scanSourceRoot(
  sourceRoot: string,
): Promise<FolderSnapshot[]> {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const folders: FolderSnapshot[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || isHidden(entry.name)) continue;
    const files = await listFiles(path.join(sourceRoot, entry.name));
    folders.push({
      name: entry.name,
      files,
      fingerprint: fingerprintFiles(files),
    });
  }
  return folders.sort((a, b) => (a.name < b.name ? -1 : 1));
}

/**
 * Remembers each folder's fingerprint and since when it has not changed, so a
 * folder counts as uploaded only after a quiet period without new files.
 *
 * The memory is per process: after a restart every folder waits one full quiet
 * period again, which only delays an import, never loses one.
 */
export class QuietTracker {
  private readonly seen = new Map<
    string,
    { fingerprint: string; since: number }
  >();

  constructor(private readonly quietMs: number) {}

  /** Record a scan of `name`; true once it has been unchanged for the quiet period. */
  observe(name: string, fingerprint: string, now: Date): boolean {
    const previous = this.seen.get(name);
    if (!previous || previous.fingerprint !== fingerprint) {
      this.seen.set(name, { fingerprint, since: now.getTime() });
      return this.quietMs <= 0;
    }
    return now.getTime() - previous.since >= this.quietMs;
  }

  /** Drop every folder not in `names` (it was deleted or renamed on Drive). */
  retainOnly(names: ReadonlySet<string>): void {
    for (const name of this.seen.keys()) {
      if (!names.has(name)) this.seen.delete(name);
    }
  }

  /** Stop tracking a folder the importer has settled on. */
  forget(name: string): void {
    this.seen.delete(name);
  }
}
