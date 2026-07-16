/**
 * Presentational components for the coach-only roster surface. Pages import from
 * here and pass in the players they load; these components hold no queries and
 * mount the interactive rotation/erasure forms from the feature layer.
 */
export { PlayerRoster } from "./PlayerRoster";
export { PlayerRosterSkeleton } from "./PlayerRosterSkeleton";
export { PlayerRow } from "./PlayerRow";
export { RosterHeader } from "./RosterHeader";
export { ShareLinkField } from "./ShareLinkField";
