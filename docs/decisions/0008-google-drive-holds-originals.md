# 0008 - Google Drive holds the originals, the VPS holds only derived files

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none (amended by
  [ADR 0013](0013-native-mac-app-is-the-coachs-editing-desk.md): the originals of a game
  registered by the Mac app start on the Mac and reach Drive later as a background backup that the
  ingest worker links instead of importing, and the Mac, not the VPS, encodes that game's browser
  copy)

Amends [ADR 0003](0003-hardware-role-split.md): Google Drive replaces the NAS as cold storage for
the original recordings, and the VPS gains one kind of re-encode (the tagging proxy). Everything
else in 0003 is unchanged.

## Context

ADR 0003 assumed a NAS for raw recordings and finished clips, and P2-9 assumed a watched NAS
folder from which `hockey-video-pipeline` would register games through `POST /api/ingest`. Neither
exists: there is no NAS in the deployment, and the pipeline never grew the watcher, so every game
so far has been entered by hand in "Neues Spiel" - a path per chapter, plus a 720p proxy made by
hand on a laptop so the browser can play it (ADR 0006).

The facts that shape the replacement:

- The app runs on a single VPS with limited disk. A game is 4-8 GoPro chapters of ~4 GB each, so
  keeping originals on the VPS does not scale past a few games.
- The originals must be kept in full quality, and the coach already keeps them on Google Drive.
- Clips are copy-cut from the originals (ADR 0004); the proxy is only a playback convenience.
- Uploading a game to Drive takes hours on a home connection, so nothing that waits for it can be
  interactive anyway.

## Decision

We keep **the original recordings on Google Drive** and **only derived files on the VPS**.

- **Drive layout.** One folder per game under a shared root (e.g. `Hockey/2026-05-12 vs Rot-Weiss/`)
  holding that game's GoPro chapter files. The coach uploads there; that is the whole import step.
- **Read-only access.** The VPS reads Drive through a Google Cloud service account that the root
  folder is shared with as **Viewer**, via rclone. The VPS never writes, moves or deletes anything
  on Drive: an automated job cannot damage the only full-quality copy, and there is no personal
  login token to expire. Which folders are already imported is tracked in the database, not by
  moving folders around.
- **Drive as a filesystem.** rclone mounts the root read-only on the VPS host with a size-capped
  VFS cache. ffmpeg and ffprobe read chapter files through the mount as if they were local; a
  seek fetches only the byte ranges it needs, so a copy-cut does not download a 4 GB chapter.
- **An ingest worker in this repo** (like the clip worker, ADR 0007) polls the root for game
  folders it has not imported. Once a folder has had no new file for a quiet period, it sorts the
  chapters by the GoPro naming convention, reads each chapter's duration and the recording date
  with ffprobe, writes the proxies, and registers the game in the needs-a-name state. P2-9's
  `POST /api/ingest` stays for an external caller but is no longer the main path. (Refined
  2026-09-24 against the real Drive folder: game folders are tracked by their name in the mount,
  the same prefix their chapters carry in `game_sources.file_path`, and besides GoPro chapters the parts may be exported halves or quarters named `halbzeit<N>` or
  `viertel<N>`; other files in a game folder are ignored. The exact rules are in P2-17.)
- **Paths.** `game_sources.file_path` is the chapter's path relative to the Drive root, so the
  proxy convention of ADR 0006 (same relative path under the proxy root) holds unchanged.
- **VPS disk** holds only what is served or rebuilt from the originals: the 720p proxies (~1-2 GB
  per game) and the finished clips.
- **Proxy transcode on the VPS.** The 720p proxy is the one re-encode the VPS may run, as a
  background batch job: one proxy at a time, at the lowest CPU priority (`nice`), with a capped
  thread count. It preserves duration as ADR 0006 requires, and the stored `duration_s` comes from
  the original, never the proxy.

Alternatives considered:

- **Originals on the VPS** - simplest to read, but the disk fills after a handful of games.
- **Personal OAuth login for rclone** - works, but the token belongs to one person and can be
  revoked or expire; a service account is a deploy-time credential like `DATABASE_URL`.
- **Moving imported folders into an archive folder on Drive** - makes the state visible in Drive,
  but needs write access to the originals, and a non-owner cannot reliably move files in another
  person's My Drive. The database already knows what was imported.
- **Proxies on the M4 (ADR 0003's rule)** - keeps the VPS encode-free, but the M4 is not always
  on, so a game would wait for someone to open a laptop. That defeats "upload and forget".
- **The Drive API directly instead of a mount** - no FUSE on the host, but ffmpeg would need
  signed URLs or full downloads, and the worker would re-implement range caching rclone already
  has.

## Consequences

- Importing a game becomes "upload the folder to Drive"; the game appears in the app a while
  after the upload finishes. The manual "Neues Spiel" form stays as a fallback.
- VPS disk use grows with proxies and clips only, a small fraction of the originals.
- The VPS now does sustained CPU work while a proxy is encoding (roughly tens of minutes per
  game). Low priority and one job at a time keep the app responsive; if tagging or link serving
  still slows down noticeably, proxy encoding moves to the M4 and this decision is revisited.
- Clip cuts depend on Drive being reachable. A Drive outage fails a cut the way a missing file
  does today (the clip goes `failed` and can be re-queued); already-cut clips and proxies keep
  working because they live on the VPS.
- New operational pieces on the VPS: a service account key (a secret, outside the repo), an
  rclone config and a host-level read-only mount with a capped cache, exposed to the worker
  containers. These need a setup doc under `docs/ops/`.
- The worker needs two roots where it has one today: `CLIP_MEDIA_ROOT` currently holds both the
  chapters it reads and the clips it writes. Chapters now come from the read-only Drive mount and
  clips go to VPS disk, so the worker config splits into a source root and an output root.
- Drive API quotas are far above this workload (a few games a week), but an rclone polling
  interval of minutes, not seconds, keeps it that way.

## Note (2026-09-25)

The ~4 GB chapter size above assumed the coach's older GoPro. HERO11-13 on cards of 64 GB or more
write chapters of about 12 GB instead. The decision is unaffected - the code is chapter-size
agnostic - but a game now spans fewer, larger chapter files than this ADR's context section
implies.
