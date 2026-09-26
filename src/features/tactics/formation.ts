/**
 * Formations: named start arrangements the coach reuses, such as the team's
 * own defence, and the built-in starts a new scene can begin from. A formation
 * is a scene's view and tokens at their start positions, without lines or
 * steps, stored as its own versioned JSON document in pitch metres. It is
 * validated by the scene parser (ADR 0010), so a formation holds exactly what
 * a scene's start arrangement may hold. A scene starts from a copy and never
 * links back, so editing a formation leaves every scene made from it as it is.
 */
import { roundPoint } from "./geometry";
import {
  CENTRE,
  GOAL_POST_WIDTH,
  GOAL_WIDTH,
  type PitchPoint,
  type PitchView,
} from "./pitch";
import {
  emptyScene,
  MAX_SCENE_JSON_LENGTH,
  newScene,
  parseScene,
  SCENE_VERSION,
  withoutRosterLinks,
  type BoardToken,
  type PlayerToken,
  type TacticsScene,
  type Team,
} from "./scene";

/** The formation format this code writes. */
export const FORMATION_VERSION = 1;

/** Whether the coach's team attacks or defends in a formation. */
export type FormationKind = "attack" | "defence";
export const FORMATION_KINDS: readonly FormationKind[] = ["attack", "defence"];

export interface TacticsFormation {
  readonly version: typeof FORMATION_VERSION;
  /** The view a scene started from it shows, fixed like a scene's. */
  readonly view: PitchView;
  /** Players and at most one ball, bottom to top. No token links to a roster player. */
  readonly tokens: readonly BoardToken[];
}

/**
 * Validate an untrusted formation (parsed JSON), returning a clean copy or
 * `null`. The view and tokens pass the scene parser, so they are checked and
 * rounded exactly like a scene's; a token linked to a roster player is
 * refused, since a formation stands for positions, not people.
 */
export function parseFormation(raw: unknown): TacticsFormation | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== FORMATION_VERSION) return null;
  const scene = parseScene({
    version: SCENE_VERSION,
    view: value.view,
    tokens: value.tokens,
    lines: [],
    steps: [],
  });
  if (!scene) return null;
  if (scene.tokens.some((token) => token.kind === "player" && token.playerId))
    return null;
  return { version: FORMATION_VERSION, view: scene.view, tokens: scene.tokens };
}

/**
 * Parse a formation submitted as JSON text, or `null` when it is too long,
 * not JSON, or not a valid formation.
 */
export function parseFormationJson(text: unknown): TacticsFormation | null {
  if (typeof text !== "string" || text.length > MAX_SCENE_JSON_LENGTH)
    return null;
  try {
    return parseFormation(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * A scene's start arrangement as a formation: its view and its tokens where
 * they stand before the first step, without roster links. Lines and steps
 * stay with the scene.
 */
export function formationFromScene(scene: TacticsScene): TacticsFormation {
  return {
    version: FORMATION_VERSION,
    view: scene.view,
    tokens: withoutRosterLinks(scene).tokens,
  };
}

/** A new scene from a formation: a copy of its tokens, no lines, no steps. */
export function sceneFromFormation(formation: TacticsFormation): TacticsScene {
  return {
    version: SCENE_VERSION,
    view: formation.view,
    tokens: formation.tokens.map((token) => ({ ...token })),
    lines: [],
    steps: [],
  };
}

/** How many players of each team a formation holds. */
export function teamCounts(
  tokens: readonly BoardToken[],
): Record<Team, number> {
  const counts = { home: 0, away: 0 };
  for (const token of tokens) if (token.kind === "player") counts[token.team]++;
  return counts;
}

/**
 * The starts a new scene can take without a saved formation, per view. The
 * first is the default. The whole pitch starts from the plain 1-3-4-3 or
 * empty; the short corner from only the ball, or a standard penalty corner
 * with the coach's team defending or attacking.
 */
export type BuiltInStart =
  "lineup" | "empty" | "ball" | "corner-defence" | "corner-attack";
export const BUILT_IN_STARTS: Readonly<
  Record<PitchView, readonly BuiltInStart[]>
> = {
  full: ["lineup", "empty"],
  corner: ["ball", "corner-defence", "corner-attack"],
};

/** The outer edge of a goal post from the middle of the goal, in metres. */
const POST_OUTER = GOAL_WIDTH / 2 + GOAL_POST_WIDTH;
/** The injection: on the back-line at the 10 m mark above the goal. */
const INJECTION_Y = CENTRE.y - POST_OUTER - 10;

/** A player's place and label in a built-in start. */
interface Place extends PitchPoint {
  readonly label: string;
}

/**
 * A standard penalty corner at the left goal (rule 13.3): the keeper and four
 * defenders behind the back-line in the goal, the injector behind the ball at
 * the 10 m mark, and five attackers just outside the circle, the stopper and
 * the hitter at its top.
 */
const CORNER_DEFENCE: readonly Place[] = [
  { label: "TW", x: -0.6, y: CENTRE.y },
  { label: "2", x: -0.6, y: CENTRE.y - 0.73 },
  { label: "3", x: -0.6, y: CENTRE.y + 0.73 },
  { label: "4", x: -0.6, y: CENTRE.y - 1.46 },
  { label: "5", x: -0.6, y: CENTRE.y + 1.46 },
];
const CORNER_ATTACK: readonly Place[] = [
  { label: "1", x: -0.5, y: INJECTION_Y },
  { label: "2", x: 15.2, y: CENTRE.y },
  { label: "3", x: 15.6, y: CENTRE.y + 0.9 },
  { label: "4", x: 14.6, y: 20.5 },
  { label: "5", x: 14.6, y: 34.5 },
  { label: "6", x: 12, y: 39 },
];

/** The penalty corner with the coach's team (home) defending or attacking. */
function cornerScene(home: FormationKind): TacticsScene {
  const byTeam: Record<Team, readonly Place[]> =
    home === "defence"
      ? { home: CORNER_DEFENCE, away: CORNER_ATTACK }
      : { home: CORNER_ATTACK, away: CORNER_DEFENCE };
  const players = [...byTeam.home, ...byTeam.away].map(
    ({ label, ...at }, index): PlayerToken => ({
      id: `p${index + 1}`,
      kind: "player",
      team: index < byTeam.home.length ? "home" : "away",
      label,
      playerId: null,
      ...roundPoint(at),
    }),
  );
  return {
    version: SCENE_VERSION,
    view: "corner",
    tokens: [
      ...players,
      { id: "b1", kind: "ball", ...roundPoint({ x: 0, y: INJECTION_Y }) },
    ],
    lines: [],
    steps: [],
  };
}

/** True when `value` is a built-in start of `view`. */
export function isBuiltInStart(
  view: PitchView,
  value: unknown,
): value is BuiltInStart {
  return BUILT_IN_STARTS[view].some((start) => start === value);
}

/** A new scene from a built-in start. */
export function builtInScene(start: BuiltInStart): TacticsScene {
  switch (start) {
    case "lineup":
      return newScene("full");
    case "empty":
      return emptyScene();
    case "ball":
      return newScene("corner");
    case "corner-defence":
      return cornerScene("defence");
    case "corner-attack":
      return cornerScene("attack");
  }
}
