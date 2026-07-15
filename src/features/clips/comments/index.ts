/**
 * Public surface of the clip-comments feature (P1-2). Coaches and login-free
 * share-link viewers read and post comments on a clip through
 * `GET`/`POST /api/clips/[id]/comments`; the queries persist and read them back,
 * and {@link canShareTokenReachClip} authorizes a share token against a clip so
 * a link never reaches beyond the clips it may see.
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
  listCommentsForClip,
  type CommentRow,
} from "./queries";
