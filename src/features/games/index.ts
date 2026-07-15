/**
 * Public surface of the games feature. Pages and sibling lanes import the form,
 * the list query and copy from here rather than reaching into internal modules.
 */
export { GameForm } from "./GameForm";
export { gamesContent } from "./content";
export { formatDuration, formatPlayedOn } from "./format";
export { listGames, type GameListItem } from "./queries";
