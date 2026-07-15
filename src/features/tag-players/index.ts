/**
 * Public, client-safe surface of the tag-players feature (P0-7). The tagging UI
 * links one or more players to a captured tag and sets its visibility (`team` or
 * `single`) through `PUT /api/tags/[id]/players` via {@link TagPlayersEditor}.
 *
 * Server-only database access (`getTagPlayers`, `setTagPlayers`, `listRoster`)
 * lives in `./queries` and is imported from there directly, so this barrel stays
 * importable from client components (matching the `player` feature's split).
 */
export {
  parseTagPlayersInput,
  type TagPlayersInput,
  type Visibility,
  type ParseResult,
} from "./validation";
export type { TagPlayers, RosterPlayer } from "./queries";
export { tagPlayersContent } from "./content";
export {
  TagPlayersEditor,
  type TagPlayersEditorProps,
} from "./TagPlayersEditor";
