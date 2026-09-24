/**
 * Which files in a game folder are the game, and in what order (P2-17).
 *
 * A folder on Drive holds a game's recording plus whatever else the coach put
 * next to it (a goal clip, a screenshot). Only three naming schemes count as
 * parts of the recording, matched case-insensitively:
 *
 * - `halbzeit<N>` - an exported half (`halbzeit1.mp4`, `Halbzeit 2.mp4`),
 * - `viertel<N>` - an exported quarter (`Viertel1.mp4`),
 * - GoPro chapters `GX<CC><NNNN>.MP4` (HEVC) or `GH<CC><NNNN>.MP4` (H.264): chapter
 *   `CC` of recording `NNNN`, ordered by recording, then chapter.
 *
 * Everything else is ignored. A folder that mixes schemes, repeats a part or
 * skips a number is not a game this module can order, so it is reported as
 * invalid with a reason rather than guessed at.
 *
 * Pure: file names in, ordered file names out, so the rule is unit-tested
 * without a filesystem.
 */
import { MAX_SOURCES } from "@/features/games/validation";

/** The naming scheme a folder's parts follow. */
export type PartScheme = "halbzeit" | "viertel" | "gopro";

export type GamePartsResult =
  /** The folder's parts in play order, plus the files that were ignored. */
  | {
      kind: "parts";
      scheme: PartScheme;
      parts: string[];
      ignored: string[];
    }
  /** No file in the folder is a game part (yet). */
  | { kind: "none"; ignored: string[] }
  /** Parts exist but cannot be ordered into one game. */
  | { kind: "invalid"; reason: string };

/** One recognised part and the key it sorts by. */
interface Part {
  readonly name: string;
  readonly scheme: PartScheme;
  /** GoPro recording number; 0 for the exported schemes. */
  readonly recording: number;
  /** Half, quarter or GoPro chapter number. */
  readonly index: number;
}

const VIDEO_EXTENSION = String.raw`\.(?:mp4|mov)$`;
const EXPORTED_PART = new RegExp(
  String.raw`^(halbzeit|viertel)[\s_-]*(\d{1,2})${VIDEO_EXTENSION}`,
  "i",
);
const GOPRO_CHAPTER = /^G[XH](\d{2})(\d{4})\.mp4$/i;

function parsePart(name: string): Part | null {
  const exported = EXPORTED_PART.exec(name);
  if (exported) {
    return {
      name,
      scheme: exported[1].toLowerCase() as PartScheme,
      recording: 0,
      index: Number(exported[2]),
    };
  }
  const gopro = GOPRO_CHAPTER.exec(name);
  if (gopro) {
    return {
      name,
      scheme: "gopro",
      recording: Number(gopro[2]),
      index: Number(gopro[1]),
    };
  }
  return null;
}

function label(part: Part): string {
  return part.scheme === "gopro"
    ? `GoPro recording ${part.recording} chapter ${part.index}`
    : `${part.scheme}${part.index}`;
}

/**
 * Check that each recording's numbers run 1, 2, 3, ... without a repeat or a
 * gap, and return the first problem found.
 */
function findSequenceProblem(sorted: readonly Part[]): string | null {
  for (let i = 0; i < sorted.length; i += 1) {
    const part = sorted[i];
    const previous = i > 0 ? sorted[i - 1] : null;
    const sameRecording = previous?.recording === part.recording;
    const expected = sameRecording && previous ? previous.index + 1 : 1;
    if (sameRecording && previous && part.index === previous.index) {
      return `${label(part)} appears twice (${previous.name}, ${part.name})`;
    }
    if (part.index !== expected) {
      const missing = { ...part, index: expected };
      return `${label(missing)} is missing`;
    }
  }
  return null;
}

/** Pick and order the game parts among the file names of one folder. */
export function selectGameParts(fileNames: readonly string[]): GamePartsResult {
  const parts: Part[] = [];
  const ignored: string[] = [];
  for (const name of fileNames) {
    const part = parsePart(name);
    if (part) {
      parts.push(part);
    } else {
      ignored.push(name);
    }
  }
  ignored.sort();

  if (parts.length === 0) {
    return { kind: "none", ignored };
  }

  const schemes = [...new Set(parts.map((part) => part.scheme))].sort();
  if (schemes.length > 1) {
    return {
      kind: "invalid",
      reason: `the folder mixes ${schemes.join(" and ")} files`,
    };
  }

  if (parts.length > MAX_SOURCES) {
    return {
      kind: "invalid",
      reason: `the folder has ${parts.length} parts, more than ${MAX_SOURCES}`,
    };
  }

  // The name breaks ties only so a repeated part is reported the same way
  // whatever order the directory listing came in.
  const sorted = [...parts].sort(
    (a, b) =>
      a.recording - b.recording ||
      a.index - b.index ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
  const problem = findSequenceProblem(sorted);
  if (problem) {
    return { kind: "invalid", reason: problem };
  }

  return {
    kind: "parts",
    scheme: schemes[0],
    parts: sorted.map((part) => part.name),
    ignored,
  };
}
