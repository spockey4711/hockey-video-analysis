/**
 * Public surface of the tag-players feature (P0-7). The tagging UI links one or
 * more players to a captured tag and sets its visibility (`team` or `single`)
 * through `PUT /api/tags/[id]/players`; the clip and share flows (P0-9, P0-11)
 * read `getTagPlayers` to route a tag's clip to the right share links.
 */
export {
  parseTagPlayersInput,
  type TagPlayersInput,
  type Visibility,
  type ParseResult,
} from "./validation";
export { getTagPlayers, setTagPlayers, type TagPlayers } from "./queries";
export { tagPlayersContent } from "./content";
