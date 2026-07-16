/**
 * Public surface of the clip-collections feature (P2-13). Composes two lanes off
 * the post-MVP `collections`/`collection_clips` tables: the coach-only curation
 * surfaces (list + detail, behind the coach guard) and the login-free share view
 * (its own secret token, reusing the shared `ShareShell`/`PlaylistPlayer`).
 *
 * This barrel is imported by Server Components (the pages) only. The client
 * components deliberately import `content`/`state`/`actions` directly, so the
 * `server-only` queries here never reach the client bundle.
 */

// Coach-side reads and mutations.
export {
  listCollections,
  getCollectionForEdit,
  listReadyClipsForCuration,
  createCollection,
  saveCollection,
  deleteCollection,
  rotateCollectionShareToken,
  type CollectionListItem,
  type CollectionForEdit,
  type CurationClipRow,
} from "./queries";

// Login-free share reads and the display mapper.
export {
  getCollectionByShareToken,
  listReadyClipsForCollection,
  type ShareCollection,
  type CollectionClipRow,
} from "./share-queries";
export { toPlaylistItems } from "./clip-items";

// Pure helpers and copy shared by both lanes.
export { toCurationItems, type CurationItem } from "./curation-items";
export { collectionSharePath, collectionShareUrl } from "./share-link";
export { collectionsContent } from "./content";

// Surfaces composed by the pages.
export { CollectionsList } from "./CollectionsList";
export { CreateCollectionForm } from "./CreateCollectionForm";
export { CollectionEditor } from "./CollectionEditor";
export { CollectionSettings } from "./CollectionSettings";
