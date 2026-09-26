/**
 * Every file under `contracts/` that is generated from the web app's
 * TypeScript, and the drift check behind `pnpm contracts:check` (ADR 0013).
 *
 * The TypeScript stays the reference; the JSON is its output. The check
 * compares parsed JSON, so formatting never makes it fail, only content does.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { buildCutPlan } from "./cut-plan";
import { buildGameClock } from "./game-clock";
import { buildGameFormat } from "./game-format";
import { buildGameParts } from "./game-parts";
import { buildPitch } from "./pitch";
import { buildPlaybackRate } from "./playback-rate";
import { buildQuarters } from "./quarters";
import { buildSourceBreaks } from "./source-breaks";
import { buildSourceSegments } from "./source-segments";
import { buildTagCapture } from "./tag-capture";
import { buildTagTypes } from "./tag-types";
import { buildTimeMapping } from "./time-mapping";

/** One generated file: its path under `contracts/` and how to build it. */
export interface ContractDocument {
  readonly path: string;
  readonly build: () => unknown;
}

/** The directory under `contracts/` that holds only generated vectors. */
export const VECTORS_DIR = "vectors";

export const CONTRACT_DOCUMENTS: readonly ContractDocument[] = [
  { path: "tag-types.json", build: buildTagTypes },
  { path: "pitch.json", build: buildPitch },
  { path: `${VECTORS_DIR}/time-mapping.json`, build: buildTimeMapping },
  { path: `${VECTORS_DIR}/source-segments.json`, build: buildSourceSegments },
  { path: `${VECTORS_DIR}/source-breaks.json`, build: buildSourceBreaks },
  { path: `${VECTORS_DIR}/tag-capture.json`, build: buildTagCapture },
  { path: `${VECTORS_DIR}/game-parts.json`, build: buildGameParts },
  { path: `${VECTORS_DIR}/game-format.json`, build: buildGameFormat },
  { path: `${VECTORS_DIR}/quarters.json`, build: buildQuarters },
  { path: `${VECTORS_DIR}/cut-plan.json`, build: buildCutPlan },
  { path: `${VECTORS_DIR}/playback-rate.json`, build: buildPlaybackRate },
  { path: `${VECTORS_DIR}/game-clock.json`, build: buildGameClock },
];

/** The `contracts/` directory at the repository root. */
export const CONTRACTS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** A document's JSON text, before formatting. */
export function renderContract(document: ContractDocument): string {
  return `${JSON.stringify(document.build())}\n`;
}

/** Why a file under `contracts/` does not match the TypeScript reference. */
export interface ContractProblem {
  readonly path: string;
  readonly problem: "missing" | "out of date" | "not generated";
}

async function readIfPresent(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Compare every generated file under `root` with what the TypeScript produces
 * now, and list the files that differ. A JSON file in the vectors directory
 * that no document produces is a leftover and counts as a problem too.
 */
export async function findContractProblems(
  root: string = CONTRACTS_ROOT,
): Promise<ContractProblem[]> {
  const problems: ContractProblem[] = [];
  for (const document of CONTRACT_DOCUMENTS) {
    const committed = await readIfPresent(path.join(root, document.path));
    if (committed === null) {
      problems.push({ path: document.path, problem: "missing" });
      continue;
    }
    const expected: unknown = JSON.parse(renderContract(document));
    let actual: unknown;
    try {
      actual = JSON.parse(committed);
    } catch {
      problems.push({ path: document.path, problem: "out of date" });
      continue;
    }
    if (!isDeepStrictEqual(actual, expected)) {
      problems.push({ path: document.path, problem: "out of date" });
    }
  }

  const generated = new Set(
    CONTRACT_DOCUMENTS.map((document) => document.path),
  );
  for (const path_ of await listVectorFiles(root)) {
    if (!generated.has(path_)) {
      problems.push({ path: path_, problem: "not generated" });
    }
  }
  return problems;
}

/** The JSON files in the vectors directory, as paths under `contracts/`. */
export async function listVectorFiles(
  root: string = CONTRACTS_ROOT,
): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(path.join(root, VECTORS_DIR));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return names
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => `${VECTORS_DIR}/${name}`);
}
