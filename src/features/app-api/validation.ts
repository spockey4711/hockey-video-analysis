/**
 * Parse functions for the Mac app's request bodies - pure, so the rules are
 * unit-tested without a request. Error strings are for the Mac's logs; the Mac
 * shows its own copy to the coach.
 */
import { cleanDeviceName } from "@/features/access/device-label";
import { normalizeEmail } from "@/features/access/validation";
import { isUuid } from "@/features/clips/validation";
import {
  validateGameReview,
  type ValidatedGameReview,
} from "@/features/games/review";
import {
  DURATION_MAX_S,
  MAX_SOURCES,
  PATH_MAX_LENGTH,
  validateOpponent,
  validatePlayedOn,
  validateTitle,
} from "@/features/games/validation";

/** A device sign-in: the coach's credentials and the name the Mac goes by. */
export interface DeviceSignIn {
  email: string;
  password: string;
  deviceName: string;
}

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

// Longer than any real value; a bound on what reaches scrypt and the database.
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MAX_LENGTH = 200;

/** Validate `POST /api/app/v1/sessions`'s body. */
export function parseDeviceSignIn(raw: unknown): ParseResult<DeviceSignIn> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const { email, password, deviceName } = raw as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: "email and password are required" };
  }
  if (typeof deviceName !== "string") {
    return { ok: false, error: "deviceName is required" };
  }
  const normalized = normalizeEmail(email);
  if (
    !normalized ||
    !password ||
    normalized.length > EMAIL_MAX_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return { ok: false, error: "email and password are required" };
  }
  const name = cleanDeviceName(deviceName);
  if (!name) return { ok: false, error: "deviceName is required" };
  return { ok: true, value: { email: normalized, password, deviceName: name } };
}

/** One chapter of a game the Mac registers, in play order. */
export interface RegisteredChapter {
  /** `<folder>/<file>` relative to the library, as on Drive (ADR 0013). */
  filePath: string;
  sizeBytes: number;
  durationS: number;
  frameRate: number | null;
}

/** A Mac game to register: its client-made id, date and chapters. */
export interface GameRegistration {
  id: string;
  /** The game folder all chapters live in, the name it will have on Drive. */
  folderPath: string;
  playedOn: string | null;
  chapters: RegisteredChapter[];
}

// A path segment the Drive scan would read as the same name: no hidden names
// (which also rules out `.` and `..`), no separators of either kind, and no
// control characters, which would break the tab- and line-separated parts
// record in `ingest_folders` (see `fileKey`).
const SEGMENT_MAX_LENGTH = 255;
const UNSAFE_SEGMENT = /[\\/\u0000-\u001f\u007f]/;

function isSafeSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment.length <= SEGMENT_MAX_LENGTH &&
    segment.trim() === segment &&
    !segment.startsWith(".") &&
    !UNSAFE_SEGMENT.test(segment)
  );
}

/**
 * Split a chapter path into its folder and file name, or `null` unless it is
 * exactly `<folder>/<file>`: relative, one level deep like a Drive game
 * folder, with no `..`, hidden or empty segment. The Mac's own paths
 * (volumes, bookmarks) never reach the server.
 */
export function splitChapterPath(
  raw: string,
): { folder: string; file: string } | null {
  if (raw.length > PATH_MAX_LENGTH) return null;
  const segments = raw.split("/");
  if (segments.length !== 2 || !segments.every(isSafeSegment)) return null;
  return { folder: segments[0], file: segments[1] };
}

// A frame rate past this is a broken probe, not a camera.
const FRAME_RATE_MAX = 1000;

function isPositiveNumber(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= max
  );
}

function parseChapter(
  raw: unknown,
): { ok: true; value: RegisteredChapter; folder: string; file: string } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const { filePath, sizeBytes, durationS, frameRate } = raw as Record<
    string,
    unknown
  >;
  if (typeof filePath !== "string") return null;
  const parts = splitChapterPath(filePath);
  if (!parts) return null;
  if (!Number.isSafeInteger(sizeBytes) || (sizeBytes as number) <= 0) {
    return null;
  }
  if (!isPositiveNumber(durationS, DURATION_MAX_S)) return null;
  if (
    frameRate !== undefined &&
    frameRate !== null &&
    !isPositiveNumber(frameRate, FRAME_RATE_MAX)
  ) {
    return null;
  }
  return {
    ok: true,
    value: {
      filePath,
      sizeBytes: sizeBytes as number,
      durationS,
      frameRate: frameRate ?? null,
    },
    ...parts,
  };
}

/** A body field that is absent, `null` or a string, as an optional string. */
function optionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : undefined;
}

/** Validate `POST /api/app/v1/games`'s body. */
export function parseGameRegistration(
  raw: unknown,
): ParseResult<GameRegistration> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;
  if (!isUuid(body.id)) {
    return { ok: false, error: "id must be a client-made uuid" };
  }

  const playedOn = optionalString(body.playedOn);
  if (playedOn === undefined || (playedOn && validatePlayedOn(playedOn))) {
    return { ok: false, error: "playedOn must be a YYYY-MM-DD date or null" };
  }

  if (
    !Array.isArray(body.chapters) ||
    body.chapters.length === 0 ||
    body.chapters.length > MAX_SOURCES
  ) {
    return {
      ok: false,
      error: `chapters must list 1 to ${MAX_SOURCES} chapters`,
    };
  }
  const chapters: RegisteredChapter[] = [];
  const files = new Set<string>();
  let folderPath: string | null = null;
  for (const [index, entry] of body.chapters.entries()) {
    const chapter = parseChapter(entry);
    if (!chapter) {
      return {
        ok: false,
        error:
          `chapters[${index}] needs a <folder>/<file> filePath, a sizeBytes, ` +
          "a durationS and an optional frameRate",
      };
    }
    folderPath ??= chapter.folder;
    if (chapter.folder !== folderPath) {
      return { ok: false, error: "all chapters must be in one folder" };
    }
    if (files.has(chapter.file)) {
      return { ok: false, error: `chapters[${index}] repeats a file` };
    }
    files.add(chapter.file);
    chapters.push(chapter.value);
  }

  return {
    ok: true,
    value: {
      id: body.id.toLowerCase(),
      folderPath: folderPath as string,
      playedOn: playedOn ? playedOn.trim() : null,
      chapters,
    },
  };
}

/** A change to a game's own fields; an absent field stays as it is. */
export interface GameFieldsPatch {
  title?: string;
  opponent?: string | null;
  playedOn?: string | null;
}

/** Validate `PATCH /api/app/v1/games/{id}`'s body. */
export function parseGameFieldsPatch(
  raw: unknown,
): ParseResult<GameFieldsPatch> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;
  const patch: GameFieldsPatch = {};

  if ("title" in body) {
    if (typeof body.title !== "string" || validateTitle(body.title)) {
      return { ok: false, error: "title must be a non-empty string" };
    }
    patch.title = body.title.trim();
  }
  if ("opponent" in body) {
    const opponent = optionalString(body.opponent);
    if (opponent === undefined || (opponent && validateOpponent(opponent))) {
      return { ok: false, error: "opponent must be a short string or null" };
    }
    patch.opponent = opponent?.trim() || null;
  }
  if ("playedOn" in body) {
    const playedOn = optionalString(body.playedOn);
    if (playedOn === undefined || (playedOn && validatePlayedOn(playedOn))) {
      return { ok: false, error: "playedOn must be a YYYY-MM-DD date or null" };
    }
    patch.playedOn = playedOn?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: "name at least one of title, opponent, playedOn",
    };
  }
  return { ok: true, value: patch };
}

/**
 * Why a valid patch cannot apply to a game in its current state, or `null`.
 * A game under review is named only by accepting it, which also demands its
 * date; an accepted game never loses its date (the review's rules).
 */
export function gamePatchConflict(
  patch: GameFieldsPatch,
  underReview: boolean,
): string | null {
  if (underReview && patch.title !== undefined) {
    return "a game under review is named by accepting it";
  }
  if (!underReview && patch.playedOn === null) {
    return "an accepted game keeps its date";
  }
  return null;
}

/** Validate `POST /api/app/v1/games/{id}/accept`'s body with the review's rules. */
export function parseGameAccept(
  raw: unknown,
): ParseResult<ValidatedGameReview> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const { title, opponent, playedOn } = raw as Record<string, unknown>;
  const fields = {
    title: optionalString(title),
    opponent: optionalString(opponent),
    playedOn: optionalString(playedOn),
  };
  if (
    fields.title === undefined ||
    fields.opponent === undefined ||
    fields.playedOn === undefined
  ) {
    return { ok: false, error: "title, opponent and playedOn must be strings" };
  }
  const result = validateGameReview({
    title: fields.title ?? "",
    opponent: fields.opponent ?? "",
    playedOn: fields.playedOn ?? "",
  });
  if (!result.ok) {
    const invalid = Object.keys(result.fieldErrors).join(", ");
    return { ok: false, error: `invalid ${invalid}` };
  }
  return { ok: true, value: result.value };
}
