/**
 * Pure validation for the drop-a-folder ingest payload (P2-9) - no DB, no
 * framework - so it is unit-testable and the route handler stays a thin shell.
 *
 * Unlike the create-game form (which returns per-field inline errors for a
 * human), this is a machine-to-machine JSON boundary: the hockey-video-pipeline
 * POSTs an already-stitched game, so a single specific error string that names
 * the offending field is what the caller needs to debug. Chapter order is
 * positional - the array index becomes `game_sources.order_index`, so the caller
 * must send the chapters in play order.
 */
import type { ValidatedGameSource } from "./validation";
import {
  DURATION_MAX_S,
  MAX_SOURCES,
  validatePlayedOn,
  validateSourcePath,
} from "./validation";

/**
 * A validated ingest submission ready to persist as a needs-a-name game. There
 * is no title (the coach names it later) and no opponent (not derivable from the
 * files); only the recording date and the ordered chapters come from the files.
 */
export interface ValidatedIngestGame {
  playedOn: string | null;
  sources: ValidatedGameSource[];
}

export type IngestParseResult =
  { ok: true; value: ValidatedIngestGame } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse and validate one chapter, returning either the row or an error. */
function parseSource(
  raw: unknown,
  index: number,
): { source: ValidatedGameSource } | { error: string } {
  if (!isRecord(raw)) {
    return { error: `sources[${index}] must be an object` };
  }

  const { filePath, durationS } = raw;
  if (typeof filePath !== "string") {
    return { error: `sources[${index}].filePath must be a string` };
  }
  const pathError = validateSourcePath(filePath);
  if (pathError) {
    return { error: `sources[${index}].filePath: ${pathError}` };
  }

  if (typeof durationS !== "number" || !Number.isFinite(durationS)) {
    return { error: `sources[${index}].durationS must be a finite number` };
  }
  if (durationS <= 0) {
    return { error: `sources[${index}].durationS must be greater than 0` };
  }
  if (durationS > DURATION_MAX_S) {
    return { error: `sources[${index}].durationS is unrealistically long` };
  }

  return { source: { filePath: filePath.trim(), durationS } };
}

/**
 * Validate a raw ingest body. The recording date is optional (absent or `null`
 * leaves the game undated); the chapter list must be a non-empty, ordered array
 * within the source-count cap.
 */
export function parseIngestGame(raw: unknown): IngestParseResult {
  if (!isRecord(raw)) {
    return { ok: false, error: "body must be a JSON object" };
  }

  const { playedOn, sources } = raw;

  let normalizedPlayedOn: string | null = null;
  if (playedOn !== undefined && playedOn !== null) {
    if (typeof playedOn !== "string") {
      return {
        ok: false,
        error: "playedOn must be a YYYY-MM-DD string or null",
      };
    }
    if (validatePlayedOn(playedOn)) {
      return { ok: false, error: "playedOn must be a valid YYYY-MM-DD date" };
    }
    normalizedPlayedOn = playedOn.trim() || null;
  }

  if (!Array.isArray(sources)) {
    return { ok: false, error: "sources must be an array of chapter files" };
  }
  if (sources.length === 0) {
    return { ok: false, error: "sources must contain at least one chapter" };
  }
  if (sources.length > MAX_SOURCES) {
    return {
      ok: false,
      error: `sources must not exceed ${MAX_SOURCES} chapters`,
    };
  }

  const validated: ValidatedGameSource[] = [];
  for (let i = 0; i < sources.length; i += 1) {
    const result = parseSource(sources[i], i);
    if ("error" in result) {
      return { ok: false, error: result.error };
    }
    validated.push(result.source);
  }

  return {
    ok: true,
    value: { playedOn: normalizedPlayedOn, sources: validated },
  };
}
