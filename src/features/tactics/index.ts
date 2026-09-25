/**
 * Public surface of the tactics board (slice 1): coach-only scenes of players,
 * ball and lines on a to-scale pitch, stored as versioned JSON in pitch
 * metres (ADR 0010). Imported by the Server Component pages only; the client
 * components import `content`, `state` and `actions` directly, so the
 * `server-only` queries never reach the client bundle.
 */
export {
  getScene,
  listBoardRoster,
  listScenes,
  type BoardRosterPlayer,
  type SceneForEdit,
  type SceneListItem,
} from "./queries";
export { isValidSceneId } from "./validation";
export { tacticsContent } from "./content";
export { CreateSceneForm } from "./CreateSceneForm";
export { ScenesList } from "./ScenesList";
export { SceneEditor } from "./SceneEditor";
