/**
 * Public surface of the clip-comments feature (P1-2). Coaches and login-free
 * share-link viewers read and post comments on a clip through
 * `GET`/`POST /api/clips/[id]/comments`, and the coach alone deletes one through
 * `DELETE /api/clips/[id]/comments/[commentId]`; the queries persist and read
 * them back, and {@link canShareTokenReachClip} authorizes a share token against
 * a clip so a link never reaches beyond the clips it may see.
 *
 * This barrel is server-side (it re-exports the `server-only` queries). The
 * browser-facing thread (P2-3) is imported by path instead so no client bundle
 * pulls the database in: `CommentThread` from `./CommentThread`, its copy from
 * `./content`, the fetch helpers from `./client`.
 */
export {
  parseCommentInput,
  AUTHOR_MAX_LENGTH,
  BODY_MAX_LENGTH,
  type CommentInput,
  type ParseResult,
} from "./validation";
export {
  addCommentToClip,
  canShareTokenReachClip,
  clipExists,
  deleteCommentFromClip,
  listCommentsForClip,
  listCommentsForClips,
  listCoachCommentsForClips,
  type CommentRow,
  type CommentWriter,
} from "./queries";
export { latestCoachCommentByClip, pinCoachComments } from "./pinning";
