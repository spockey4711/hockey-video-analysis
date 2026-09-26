/**
 * Golden vectors for validating a tag before it is stored: a new tag
 * (`POST /api/tags`) and an edit of one (`PATCH /api/tags/[id]`). The type must
 * be a configured tag type, the start a non-negative number, and an explicit
 * end must lie after the start.
 */
import { vectorCase, DEFAULT_TOLERANCE, type VectorFile } from "./vector";

import { parseTagEditInput } from "@/features/tagging/edit/validation";
import { parseTagInput } from "@/features/tagging/validation";

const GAME_ID = "00000000-0000-4000-8000-000000000001";

/** Only the outcome of a failure is pinned; each app words its own errors. */
function outcome<T extends { ok: boolean }>(result: T): T | { ok: false } {
  return result.ok ? result : { ok: false };
}

function createCase(name: string, body: unknown) {
  return vectorCase(name, "parseTagInput", { body }, (i) =>
    outcome(parseTagInput(i.body)),
  );
}

function editCase(name: string, body: unknown) {
  return vectorCase(name, "parseTagEditInput", { body }, (i) =>
    outcome(parseTagEditInput(i.body)),
  );
}

export function buildTagValidation(): VectorFile {
  return {
    contract: "tag-validation",
    description:
      "parseTagInput validates a new tag: a game id (a UUID), a type from " +
      "tag-types.json, a finite start of at least 0, and an optional end that " +
      "must lie after the start (absent or null is stored as null, the type's " +
      "default window). parseTagEditInput validates an edit the same way " +
      "without the game id. Error texts are left out.",
    reference: [
      "src/features/tagging/validation.ts",
      "src/features/tagging/edit/validation.ts",
    ],
    tolerance: DEFAULT_TOLERANCE,
    cases: [
      createCase("a tag with an explicit end", {
        gameId: GAME_ID,
        type: "goal",
        startS: 990,
        endS: 1005,
      }),
      createCase("a missing end is stored as null", {
        gameId: GAME_ID,
        type: "corner_short",
        startS: 992,
      }),
      createCase("a null end is stored as null", {
        gameId: GAME_ID,
        type: "action_bad",
        startS: 0,
        endS: null,
      }),
      createCase("rejects a body that is not an object", "goal"),
      createCase("rejects a malformed game id", {
        gameId: "game-1",
        type: "goal",
        startS: 990,
      }),
      createCase("rejects an unknown type", {
        gameId: GAME_ID,
        type: "retired_type",
        startS: 990,
      }),
      createCase("rejects a type given by its label", {
        gameId: GAME_ID,
        type: "Tor",
        startS: 990,
      }),
      createCase("rejects a negative start", {
        gameId: GAME_ID,
        type: "goal",
        startS: -1,
      }),
      createCase("rejects a start that is not a number", {
        gameId: GAME_ID,
        type: "goal",
        startS: "990",
      }),
      createCase("rejects an end at the start", {
        gameId: GAME_ID,
        type: "goal",
        startS: 990,
        endS: 990,
      }),
      createCase("rejects an end that is not a number", {
        gameId: GAME_ID,
        type: "goal",
        startS: 990,
        endS: "1005",
      }),

      editCase("an edit with an explicit end", {
        type: "action_good",
        startS: 1226.56,
        endS: 1238.56,
      }),
      editCase("an edit back to the default window", {
        type: "goal",
        startS: 990,
        endS: null,
      }),
      editCase("a game id in an edit is ignored", {
        gameId: "game-1",
        type: "goal",
        startS: 990,
      }),
      editCase("rejects an edit that is not an object", null),
      editCase("rejects an edit with an unknown type", {
        type: "retired_type",
        startS: 990,
      }),
      editCase("rejects an edit with a negative start", {
        type: "goal",
        startS: -0.5,
      }),
      editCase("rejects an edit ending before its start", {
        type: "goal",
        startS: 990,
        endS: 989,
      }),
    ],
  };
}
