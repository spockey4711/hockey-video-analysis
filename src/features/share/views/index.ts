/**
 * Public surface of anonymous view counting on the collection share link
 * (ADR 0009): validating a report, recording it, and reading a collection's
 * figures back for the coach.
 *
 * This barrel is server-side (it re-exports the `server-only` recording and
 * queries). The players import the browser half by path instead - `./client`
 * for the handlers, `./tracker` for the counting rules - so no client bundle
 * pulls the database in.
 */
export {
  FULL_VIEW_SHARE,
  VIEW_EVENT_TYPES,
  VIEW_EVENTS_PATH,
  parseViewEvent,
  type ParseViewEventResult,
  type ViewEventInput,
  type ViewEventType,
} from "./events";
export {
  DAILY_EVENT_LIMIT,
  DEDUPE_WINDOW_MS,
  RETENTION_DAYS,
  recordViewEvent,
  type RecordOutcome,
  type ViewerRequest,
} from "./record";
export { clientIp } from "./viewer-key";
export { getCollectionViewStats } from "./queries";
export {
  EMPTY_VIEW_COUNTS,
  summarizeViewStats,
  type CollectionViewStats,
  type ViewCounts,
} from "./stats";
