# 0009 - Count views on collection links anonymously, with a daily-rotating in-memory salt

- **Status:** Accepted
- **Date:** 2026-09-25
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

A coach shares a curated clip collection through a login-free secret link
(`/share/collection/<token>`) and wants to know whether it lands: how often each clip is opened,
watched to the end and replayed, and by how many people. There is no viewer account to attach
this to, and the audience is the coach's own players, many of them minors, so the counting must
not identify anyone.

The constraints:

- Viewers of a share link are anonymous and must stay so. The privacy policy promises no
  cookies for them and no third-party analytics.
- "Unique viewers" needs some way to tell two viewers apart without an identifier on the device.
- The app runs as a single Node process on one VPS behind nginx (see `docs/ops/vps-setup.md`),
  which sets `X-Real-IP` from the connection.
- Tracking must never slow down or break playback on the share link.

## Decision

We count views on collection share links only, server-side, the way privacy-first web analytics
(Plausible) do it.

- **What is counted.** Per collection and per clip, three event types, reported by the players on
  the collection link (the playlist and the presentation mode):
  - `click` - the viewer starts a clip (its first `play` after it loaded);
  - `full_view` - one run of the clip actually played at least 90 % of its length. Played time
    accumulates from `timeupdate` steps of at most 1.5 s, so skipping ahead does not count and a
    pause loses nothing; 90 % rather than 100 % so a viewer who stops on the last second, or a
    last `timeupdate` that lands a fraction early, still counts;
  - `replay` - the viewer starts the clip again after it ended or after a full view (the replay
    button, the native play button on a finished clip, or seeking back and playing). A replay
    begins a new run that can earn another full view.

  Team and player links report nothing.

- **Nothing on the device.** No cookie, no local or session storage, no identifier of any kind.
  The browser sends `{ token, clipId, type }` fire-and-forget with `navigator.sendBeacon`
  (falling back to a `keepalive` fetch) to `POST /api/collection-views` and swallows every error.
- **The viewer key.** The server derives it as `HMAC-SHA256(salt, ip + user agent + collection
id)`. The salt is 32 random bytes that exist only in the server process's memory and only for one
  UTC day: the first request of a new day replaces it, and it is never written to the database,
  a log or the environment. Only the key is stored, never the IP address or user agent. Once the
  day's salt is gone, a key cannot be recomputed from an IP address, and the collection id in the
  input gives the same viewer unrelated keys on different collections.
- **Unique viewers are per day.** Distinct keys are counted within a day; a multi-day figure is
  the sum of the daily figures, so someone who watches on three days counts three times. This is
  the accepted approximation.
- **Storage.** One table, `collection_view_events` (collection, clip, type, UTC day, viewer key,
  timestamp), cascading on collection and clip delete.
- **Validation and bounds.** The route accepts an event only for a ready clip in the collection
  its share token names, ignores unknown event types (`204`, for forward compatibility), rejects
  bodies over 1 KiB, and answers a token/clip mismatch with a plain `404`. An event identical to
  one the same viewer sent within 5 s is dropped, and one viewer can add at most 1000 events to
  a collection per day. A signed-in coach previewing the link is not counted.
- **Retention.** Events are kept for 365 days. Each server process deletes older events at most
  once an hour while events are being recorded, and the read side ignores older rows, so an expired
  event is never counted even before it is deleted.
- **Reading.** `getCollectionViewStats(collectionId)` returns clicks, full views, replays and
  unique viewers per clip and for the collection; the coach's insights view is built on it.

Alternatives considered:

- **A cookie or local-storage viewer id.** Exact unique counts across days, but puts an identifier
  on minors' devices and needs a consent banner. Rejected.
- **Storing the IP address, or a hash of it without a rotating salt.** A plain hash of an IPv4
  address is reversible by enumeration, and either way the table would link a person's viewing
  across days. Rejected.
- **A salt derived from an environment secret and the date.** Survives restarts, but anyone with
  the secret can recompute every past day's salt, so the keys would never become anonymous.
  Rejected.
- **A salt stored in the database and deleted after its day.** Survives restarts and works across
  several instances, but the salt then reaches backups and lingers until the next write. Not needed
  for a single process; see below for when to revisit.

## Consequences

- The coach gets per-clip and per-collection figures with no personal data stored and no consent
  banner needed; the privacy policy (`src/features/legal/content.ts`) describes the counting.
- A server restart mints a new salt, so a viewer active before and after a mid-day restart counts
  twice that day. Deploys are rare, so the error is small.
- Viewers behind one IP address with the same browser build (a club Wi-Fi, a family) count as
  one; a viewer who switches networks counts twice. A client that forges `X-Forwarded-For` where
  no proxy sets `X-Real-IP` can only inflate the unique count.
- Multi-day unique viewers overcount returning viewers by design.
- Revisit if the app runs as several processes or on serverless (Vercel): the in-memory salt then
  differs per instance and inflates the unique count, and a short-lived salt in the database
  becomes the better trade.
