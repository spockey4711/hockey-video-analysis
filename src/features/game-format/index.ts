/**
 * Public surface of the game format: the period count and length a game plays,
 * with the team default behind every game that sets none. Pages compose the
 * forms; the server actions stay internal to the lane, and server code reads
 * the stored format through `./queries`.
 */
export { gameFormatContent } from "./content";
export {
  DEFAULT_GAME_FORMAT,
  PERIOD_COUNTS,
  resolveGameFormat,
  type GameFormat,
  type GameFormatOverride,
  type PeriodCount,
} from "./format";
export { GameFormatFields } from "./GameFormatFields";
export { GameFormatForm } from "./GameFormatForm";
export { TeamFormatForm } from "./TeamFormatForm";
