/**
 * Public surface of the home feature. The landing page imports the copy, the
 * recent-games peek and the peek size from here rather than reaching into
 * internal modules.
 */
export { homeContent } from "./content";
export { RecentGamesPeek } from "./RecentGamesPeek";
export { RECENT_GAMES_PEEK_LIMIT } from "./config";
