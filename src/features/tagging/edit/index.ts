/**
 * Public surface of the tag edit/delete feature (P0-8). The watch page reads
 * `listGameTags` to seed the tags rail, whose `TagDetail` edits a tag's type and
 * clip window or deletes it through `PATCH`/`DELETE /api/tags/[id]`.
 *
 * This barrel re-exports the server-only query module, so import it only from
 * server code (the watch page) or tests. Client callers import the `EditableTag`
 * type directly to keep `server-only` out of the client bundle.
 */
export {
  parseTagEditInput,
  type TagEditInput,
  type ParseResult,
} from "./validation";
export {
  listGameTags,
  updateTag,
  deleteTag,
  type EditableTag,
} from "./queries";
export { tagEditContent } from "./content";
