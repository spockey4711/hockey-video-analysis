/**
 * Public surface of whistle-suggestion review (P1-5, PRD 5.3). The pipeline
 * (`hockey-video-pipeline`) reports double-whistle candidates into
 * `whistle_candidates`; a coach reviews them here. Confirming commits a
 * candidate to a `goal` tag (`source = suggestion`); rejecting only marks it.
 * Nothing is auto-committed, because spectator whistles cause false positives.
 *
 * A future watch-page mount places `SuggestionReview` in the player sidebar,
 * loading candidates via `listWhistleCandidates` and reviewing them through
 * `PATCH /api/suggestions/[id]`. `queries` is `server-only`; import it from
 * server code or tests, not a client component.
 */
export {
  SuggestionReview,
  type SuggestionReviewProps,
  type ReviewCandidate,
} from "./SuggestionReview";
export {
  listWhistleCandidates,
  reviewWhistleCandidate,
  type WhistleCandidateRow,
  type CommittedTag,
  type ReviewOutcome,
} from "./queries";
export { goalTagFromCandidate, SUGGESTION_TAG_TYPE } from "./review";
export {
  isValidCandidateId,
  parseReviewInput,
  type ReviewDecision,
  type ReviewInput,
} from "./validation";
export { suggestionsContent } from "./content";
