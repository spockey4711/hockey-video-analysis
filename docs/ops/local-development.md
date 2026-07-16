# Running everything locally (no NAS, no VPS)

The production architecture splits work across three machines by cost profile - an always-on VPS
coordinates, the MacBook M4 runs heavy batch jobs, and the NAS holds bulk video
([ADR 0003](../decisions/0003-hardware-role-split.md)). That split is a **deployment** decision, not
something the app hardcodes: components talk through shared state (the Postgres job queue) and shared
storage (file paths), so "where a file lives" and "where the database runs" are configuration, not
code.

That means you can start with the whole system on one Mac - app, database, and video files all local

- and grow into the machine split later by changing environment values and paths, not the
  application. This runbook is that local-only setup.

## What "local-only" means

| Concern                                 | Production ([ADR 0003](../decisions/0003-hardware-role-split.md)) | Local-only              |
| --------------------------------------- | ----------------------------------------------------------------- | ----------------------- |
| App server                              | VPS                                                               | Your Mac (`pnpm dev`)   |
| Database                                | VPS                                                               | Local Postgres (Docker) |
| Source videos + clips                   | NAS                                                               | A folder on your Mac    |
| Heavy jobs (whistle detect, ffmpeg cut) | M4 batch jobs                                                     | Same Mac, run on demand |

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

No NAS and no VPS are involved - this is an ordinary local Postgres. When you later move the database
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

When P0-3 (create a game and attach ordered chapter files) lands, you attach a game by pointing at
those files - no re-upload, same as production, just a local path instead of a NAS path. The app and
the pipeline only need paths that resolve on the machine that runs them.

Keep finished clips under the same root (e.g. `~/hockey-media/clips/`) so one folder holds everything
you would otherwise put on the NAS.

## 3. Heavy jobs run on the same Mac

The double-whistle detector and the `ffmpeg` cut-worker live in the sibling project
`hockey-video-pipeline`. In production they run as batch jobs on the M4; locally they simply run on
the same Mac, reading from and writing to your local media folder. That is fine for development - the
only thing you lose is "always-on", so a job only makes progress while your machine is awake.

## Growing into the machine split later

Because the integration surface is _paths + the DB queue_, the move from local-only to the
VPS/M4/NAS split is mostly re-homing those two things:

- **Database -> VPS:** point `DATABASE_URL` at the VPS Postgres instead of `localhost`.
- **Files -> NAS:** mount the NAS over SMB and keep your media root at the mount point, so the stored
  paths resolve there instead of under `~/hockey-media`. Any new storage-root variable is declared in
  `.env.schema` and `.env.example` when it is introduced, so the quality gate keeps them in lockstep
  (see [`../flavors/postgres.md`](../flavors/postgres.md) and the environment contract in the
  [deployment runbook](deployment.md)).
- **Heavy jobs -> M4:** run the pipeline worker on the M4 against the shared NAS paths; the app still
  only enqueues jobs and reads their status from the DB.

No application code changes for any of these - which is the point of keeping the roles out of the
code in the first place.
