# Running the app locally (no VPS)

Production keeps original recordings on Google Drive and only derived files (proxies and clips) on
the VPS ([ADR 0008](../decisions/0008-google-drive-holds-originals.md), which amends the NAS role in
[ADR 0003](../decisions/0003-hardware-role-split.md)). The app does not hardcode those hosts. It
talks to Postgres and to file paths: `MEDIA_SOURCE_ROOT` for originals, `CLIP_MEDIA_ROOT` and
`MEDIA_PROXY_ROOT` for derived files.

Locally, a Postgres container and a folder on your machine stand in for both. This runbook is that
setup. It does not start a Drive mount and it does not cut a real clip.

## What "local-only" means

| Concern            | Production ([ADR 0008](../decisions/0008-google-drive-holds-originals.md)) | Local-only                    |
| ------------------ | --------------------------------------------------------------------------- | ----------------------------- |
| App server         | VPS                                                                         | This machine (`pnpm dev`)     |
| Database           | VPS                                                                         | Local Postgres (Docker)       |
| Originals          | Google Drive, read-only rclone mount                                       | A folder, or skip playback    |
| Proxies and clips  | VPS media directory                                                         | The same local folder         |
| Clip cut           | Worker in this repo, `drive` games only                                     | Same machine, run on demand   |

Nothing about the database or the file paths assumes a specific machine - so the only difference from
the production topology is _which host_ the connection string and the paths point at.

## 1. Database on your Mac

The `postgres` flavor ships a Docker Compose `db` service for exactly this (see
[`../flavors/postgres.md`](../flavors/postgres.md)):

```bash
docker compose up -d db      # start Postgres in the background
docker compose logs -f db    # tail logs
docker compose down          # stop (data survives in the pgdata volume)
```

Point the app at it in `.env.local`:

```
DATABASE_URL=postgresql://app:app@localhost:5432/app
```

No VPS is involved - this is an ordinary local Postgres. When you later move the database
to the VPS, only `DATABASE_URL` changes; the app is unaffected.

## 2. Video files on your Mac

A game is N chapter files (a GoPro splits a long recording at ~4 GB) that form one continuous
timeline. The app does not upload or own those files - a `game_sources` row records the **path** to
each chapter in order, and the global time-mapping utility turns a game-time offset into a
`(source file, local offset)` pair ([ADR 0002](../decisions/0002-global-game-time-offset-model.md)).

Locally, that path is just a file in a folder on your Mac. Pick one root and keep your footage under
it, for example:

```
~/hockey-media/
  2026-05-12-vs-rot-weiss/
    GX010123.MP4
    GX020123.MP4
    ...
```

"Neues Spiel" stores each chapter path as given and reads the duration from the file when that
path is reachable. A local folder is the stand-in for the media root. In production the same
relative path is under the Drive mount, not a NAS path.

Keep finished clips under the same root (e.g. `~/hockey-media/clips/`) so one folder holds what
production splits between the Drive mount and the VPS media directory.

## 3. Heavy jobs run on the same Mac

The `ffmpeg` clip cut worker lives in this repo (ADR 0007) and cuts `drive` games from the source
root. Locally it runs on the same machine and only makes progress while that machine is awake. The
double-whistle detector lives in the sibling project `hockey-video-pipeline` and is not mounted in
this app.

## Growing into the machine split later

Because the integration surface is paths plus the database queue, pointing a local checkout at the
VPS is re-homing configuration, not an application change:

- **Database -> VPS:** point `DATABASE_URL` at the VPS Postgres instead of `localhost`.
- **Originals -> Drive:** mount the shared Drive root read-only and set `MEDIA_SOURCE_ROOT`. There is
  no NAS step ([ADR 0008](../decisions/0008-google-drive-holds-originals.md)).
- **Derived files -> VPS:** `CLIP_MEDIA_ROOT` and `MEDIA_PROXY_ROOT` are directories on the VPS. The
  clip worker in this repo cuts `drive` games there. The Mac is the editing desk for games that start
  on the Mac ([ADR 0013](../decisions/0013-native-mac-app-is-the-coachs-editing-desk.md), still
  Proposed), not the store for originals.

Storage-root variables are declared in `.env.schema` and `.env.example`. The
[deployment runbook](deployment.md) and [VPS setup](vps-setup.md) are the production side of this
split.
