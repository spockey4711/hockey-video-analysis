# VPS setup - transitional single-server storage (until the NAS)

A concrete provisioning runbook for running the whole app on **one VPS** as a stopgap: the app
server, PostgreSQL, and the video files all live on a single **200 GB data disk** until a NAS
takes over cold storage. This is a deliberate, temporary collapse of the roles in
[ADR 0003](../decisions/0003-hardware-role-split.md): the VPS keeps its always-on coordination
role, and it _also_ holds the bulk video storage that the NAS will later own.

The rest of `docs/ops/` still applies. This file is the opinionated, filled-in variant of the
"Target: plain VPS" section in [deployment.md](deployment.md) for this project's actual setup;
[local-development.md](local-development.md) covers running everything on your machine with no VPS
at all.

## Target setup this runbook assumes

- **OS:** Ubuntu 24.04 LTS.
- **Login user:** `<user>`, a name of your choice (sudo-capable, non-root; root login disabled
  after setup).
- **Runtime:** Docker Compose (the repo ships `Dockerfile` + `docker-compose.yml`).
- **Reverse proxy / TLS:** nginx + certbot (Let's Encrypt).
- **Data disk:** a 200 GB block device mounted at `/srv/hockey`, holding both the database data
  directory and the video files. When the NAS arrives, only the media directory moves; the
  database stays on the VPS.
- **App checkout:** the repo is cloned into `<user>`'s home directory at `/home/<user>/hockey/app`,
  with a plain `.env` there (not `.env.production`) that the compose files read.

The hard rule from ADR 0003 survives the collapse with one exception: **the VPS cuts clips only
with `ffmpeg -c copy` (no re-encoding)**, and the one re-encode it runs is the 720p tagging proxy, as
a low-priority background job ([ADR 0008](../decisions/0008-google-drive-holds-originals.md)).
Audio double-whistle analysis and ML run as batch jobs on the M4, never here. Copy-cuts are
I/O-bound, not CPU-bound, so they will not peg the small VPS.

## Directory layout on the data disk

```
/srv/hockey/
  db/       # PostgreSQL data directory (bind-mounted into the db container)
  media/    # raw source videos (game_sources.file_path is relative to here)
    clips/  # clips the cut worker writes (clips.output_path is relative to media/ too)
  backups/  # nightly pg_dump output
```

Keeping `db/` and `media/` as siblings under one mount is what makes the later NAS migration a
mount swap instead of a data migration: you move `media/` to the NAS mount and leave `db/`
untouched.

---

## 1. Base OS and the login user

Run the first block as `root` (or via the provider's console) to create the login user, then do
everything else as `<user>`.

```bash
# as root
adduser --gecos "" <user>
usermod -aG sudo <user>

# install the operator's public key for <user> (paste the key, do not reuse root's)
install -d -m 700 -o <user> -g <user> /home/<user>/.ssh
# ... write the public key into /home/<user>/.ssh/authorized_keys, then:
chown <user>:<user> /home/<user>/.ssh/authorized_keys
chmod 600 /home/<user>/.ssh/authorized_keys
```

Verify you can SSH in as `<user>` with the key **before** locking root out. Then harden SSH:

```bash
# as root, in /etc/ssh/sshd_config.d/10-hardening.conf
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
```

```bash
sudo systemctl restart ssh
```

Keep the base system patched:

```bash
sudo apt update && sudo apt -y full-upgrade
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades   # enable automatic security updates
```

## 2. Firewall

Only SSH and HTTP(S) reach the outside world. PostgreSQL is never exposed - it stays on Docker's
internal network.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

## 3. The 200 GB data disk

Identify the block device (do **not** guess - a wrong device wipes the wrong disk):

```bash
lsblk -f
```

Assuming the data disk is `/dev/sdb` and is empty, create one partition, format it ext4, and mount
it permanently at `/srv/hockey`:

```bash
sudo parted /dev/sdb --script mklabel gpt mkpart primary ext4 0% 100%
sudo mkfs.ext4 -L hockey /dev/sdb1

sudo mkdir -p /srv/hockey
echo 'LABEL=hockey  /srv/hockey  ext4  defaults,noatime  0  2' | sudo tee -a /etc/fstab
sudo mount -a
findmnt /srv/hockey        # confirm it is mounted
```

Create the layout and hand it to `<user>`:

```bash
sudo mkdir -p /srv/hockey/{db,media,backups}
sudo chown -R <user>:<user> /srv/hockey/media /srv/hockey/backups
# db/ is chowned by the postgres image on first init; leave it root-owned for now
```

If the provider attaches the volume as a raw disk that already has a filesystem, skip `parted` /
`mkfs` and just add the `fstab` line by its `LABEL=` or `UUID=` (from `lsblk -f`).

## 4. Docker and Compose

```bash
sudo apt -y install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker <user>   # log out and back in for this to take effect
docker --version && docker compose version
```

## 5. Deploy the app with Compose

The shipped `docker-compose.yml` is wired for **local development** (NODE_ENV=development, the db
port published to the host). For the VPS, add a production override that binds the app to localhost
only, points the database volume at the data disk, and never publishes Postgres. Create it on the
server next to the checked-out repo as `docker-compose.prod.yml` (this file is not committed - it
carries deployment-specific paths, not app code):

```yaml
# docker-compose.prod.yml - VPS overrides, layered on top of docker-compose.yml
services:
  app:
    environment:
      NODE_ENV: production
    ports: !override
      - "127.0.0.1:3000:3000" # only nginx reaches the app; not public

  db:
    ports: !override [] # never publish Postgres to the host or the world
    volumes:
      - /srv/hockey/db:/var/lib/postgresql/data
```

Get the code and the environment onto the server, then bring it up:

```bash
sudo -u <user> -i
git clone https://github.com/spockey4711/hockey-video-analysis.git /home/<user>/hockey/app
cd /home/<user>/hockey/app
git checkout master            # deploy the promoted, always-deployable branch

cp .env.example .env
# fill in .env (see the checklist in section 10), then:

docker compose --env-file .env \
  -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Roll back by checking out the previous tag/SHA and re-running the `up -d --build` line - keep the
last known-good commit noted somewhere.

## 6. The clip cut worker

Tagging a moment only enqueues a `pending` row in `clips`; the worker is what turns it into a
playable file, so without it every share link stays empty. It ships in this repo (ADR 0007) as the
`worker` stage of the same `Dockerfile`, and runs as its own service - not inside the web server.

Add it to `docker-compose.prod.yml`:

```yaml
worker:
  build:
    context: .
    target: worker
  env_file:
    - .env
  environment:
    CLIP_MEDIA_ROOT: /srv/media
    CLIP_OUTPUT_DIR: clips
  volumes:
    - /srv/hockey/media:/srv/media
  restart: unless-stopped
  depends_on:
    db:
      condition: service_healthy
```

Run **one** worker. Claiming uses `FOR UPDATE SKIP LOCKED`, so a second one would not corrupt the
queue, but the worker also re-queues clips left `processing` at startup, which assumes it is the
only one cutting.

The chapter paths in `game_sources.file_path` and the worker's `output_path` are both relative to
`CLIP_MEDIA_ROOT`, which is the same directory nginx serves as `MEDIA_BASE_URL` - so a finished
clip at `clips/<id>-<cut>.mp4` is immediately reachable at `<MEDIA_BASE_URL>/clips/<id>-<cut>.mp4`
with no extra configuration. `<cut>` is fresh on every cut: when a coach edits a tag's window, its
clip is cut again under a new name (so no browser or proxy cache keeps the old window) and the
worker deletes the previous file once the row points at the new one.

Check on it with:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f worker
```

A clip that cannot be cut - a missing chapter file, an unreadable source - is marked `failed`
rather than retried; the coach re-enqueues it from the game's clip board once the cause is fixed.

### Where a clip file really starts (`clips.cut_start_s`)

A copy-cut starts at the keyframe before the tag, so the file begins a little earlier than the tag.
The clip editor places trims, zooms and markers at exact moments (ADR 0011), so after every cut the
worker asks ffprobe where the file really starts and stores it as `clips.cut_start_s` (the game
time at clip-file time 0). That is three small ffprobe reads - the chapter's header, one packet at
the cut point, and the new file's header - and no re-encode. A failed probe only logs
`could not probe where its file starts`; the clip is still `ready` and plays as before.

Clips cut before this existed, and clips whose probe failed, get the value from a **probe-only
backfill** that the worker runs whenever the cut queue is empty. It takes one such clip at a time,
reads the same three headers against the clip's existing file, and records the result (`file starts
<n>s before the tag (backfilled)` in the log). It never re-cuts and never touches a clip that is
being re-cut, and it checks the cut queue again before every clip, so new cuts never wait behind it.
Once every ready clip has a value the worker is idle again. A clip whose probe fails - its file or
chapter is missing - is skipped until the worker restarts, so a restart after fixing the cause is
enough to retry it. To see how many clips are still waiting:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db \
  psql -U app -d app -c "select count(*) from clips where status = 'ready' and cut_start_s is null"
```

## 6b. The Drive import worker

The originals live on Google Drive ([ADR 0008](../decisions/0008-google-drive-holds-originals.md)),
mounted read-only at `/mnt/hockey-drive` ([google-drive-mount.md](google-drive-mount.md)). The
ingest worker (P2-17) turns a game folder uploaded there into a game in the app and encodes its
720p tagging proxies. It runs from the same `worker` image stage as the clip worker, with its own
command. Add it to `docker-compose.prod.yml`, and point the clip worker at the mount as well:

```yaml
worker:
  # ...as above, plus:
  environment:
    MEDIA_SOURCE_ROOT: /media/source
  volumes:
    - /srv/hockey/media:/srv/media
    - /mnt/hockey-drive:/media/source:ro,rslave

ingest:
  build:
    context: .
    target: worker
  command: ["node_modules/.bin/tsx", "scripts/ingest-worker.ts"]
  env_file:
    - .env
  environment:
    MEDIA_SOURCE_ROOT: /media/source
    MEDIA_PROXY_ROOT: /srv/media/proxy
  user: "1001:1001"
  volumes:
    - /srv/hockey/media:/srv/media
    - /mnt/hockey-drive:/media/source:ro,rslave
  restart: unless-stopped
  depends_on:
    db:
      condition: service_healthy
```

`rslave` lets the containers see the mount again after the rclone service restarts. The proxies go
under the media directory, so nginx serves them at `/media/proxy/...` with no extra configuration.

What the worker does, every two minutes:

- **Game folders** are the folders directly under the Drive root. A folder that has no
  `ingest_folders` row is new. It is imported only after its file list has not changed for
  `INGEST_QUIET_MINUTES` (default 120), because Drive shows each file only once it is fully
  uploaded and a whole game takes hours to upload.
- **Parts** are the files named `halbzeit<N>`, `viertel<N>` (`.mp4`/`.mov`) or GoPro
  `GX<CC><NNNN>.MP4` / `GH<CC><NNNN>.MP4`, case-insensitive, ordered by N (GoPro: by recording,
  then chapter). Any other file (a goal clip, a photo) is ignored. A folder that mixes the schemes,
  repeats a part or skips a number is recorded as `rejected` with the reason; a folder with no
  parts at all is left waiting. A rejected folder is looked at again whenever its parts change,
  so a gap left by a part that finished uploading after a later one closes by itself: once the
  missing part is there and the folder has been quiet again, it is imported.
- **Registering** reads each part's duration, video frame rate and the recording date with
  ffprobe through the mount (a few byte ranges, not the whole file) and creates the game in the
  needs-a-name state. The frame rate (`game_sources.frame_rate`) sizes the player's single-frame
  step; a part without a readable rate gets none and steps as 25 fps footage. A date is taken
  only from a plausible camera `creation_time`; otherwise it is left for the coach.
  Nothing is registered until every part has been read: a part ffprobe cannot read (a truncated
  file, Drive dropping out) or that gets no answer within two minutes keeps the whole folder
  waiting, without a row, and is retried with a growing wait, up to six hours, each attempt one
  warning line with the reason. A part that is replaced by a complete file starts a new quiet
  period.
- **Late parts**: an upload that stalls for longer than the quiet period is imported with the
  parts that were there. When more parts arrive later and the folder has been quiet again, they
  are appended to the game while it is still under "Neu eingegangen", as long as the game's
  chapters stay the first parts in play order. Once the coach has accepted the game, or when the
  folder changes in any other way (a part removed or renamed, a part that sorts before the
  imported ones), the game is left as it is: the worker logs a warning and writes the change to
  the folder's `detail`, and the note goes away once the folder matches its game again. Adding a
  part to an accepted game is a manual step (see below).
- **Proxies**: every chapter in `game_sources` should have a proxy at the same relative path under
  `MEDIA_PROXY_ROOT`. The worker encodes the newest missing one at a time, at `nice -n 19` with
  `INGEST_PROXY_THREADS` threads (default 2), checks that it lasts as long as the original, and
  only then moves it into place. That also backfills proxies for games entered by hand, as long as
  their chapters are found under `MEDIA_SOURCE_ROOT`.
- **Hidden until playable**: an imported game (`games.awaiting_proxies`) stays out of the app,
  "Neu eingegangen" included, until every one of its chapters has its proxy; appending a late part
  hides it again until that part's proxy is there. A failed encode - ffmpeg exiting with an error,
  crashing, running longer than half an hour plus six times the chapter's length, or a proxy that
  does not last as long as its original - moves nothing into place, removes the half-written
  file, logs a warning with the reason and retries the chapter after an hour, doubling up to a
  day; the game stays hidden meanwhile. A worker stopped or killed during an encode encodes the
  chapter again after its restart.
- **Never twice**: a folder with a row is never imported again - not after a worker restart, not
  when two workers run at once (the row goes in with the game in one transaction, so the second
  one backs off), and not after the coach discards its game in "Neu eingegangen" (the row stays,
  with no game). Because rows are keyed by folder name, each `skipped` and `imported` row also
  keeps the name and size of every game part in the folder (`parts`). A new folder holding any of
  those files - the folder renamed on Drive, or a copy of it - is not imported: the worker logs a
  warning once per start and leaves the folder without a row. The game keeps its chapters under
  the old folder name, so a renamed folder should be renamed back on Drive. Rows written before
  `parts` existed get it the next time their folder is seen.

On its very first run, when `ingest_folders` is still empty, the worker records every folder
already on Drive as `skipped` instead of importing it, so games entered by hand do not appear
twice. To make the worker look at a skipped folder again (one that should be imported after all),
or to re-import a folder on purpose - the game was discarded by mistake, or a folder that was
renamed on Drive should become a game under its new name - delete the original folder's row:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db \
  psql -U app -d app -c "delete from ingest_folders where folder_path = '<name>'"
```

To list the imported folders that changed in a way their game did not follow:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db \
  psql -U app -d app -c "select folder_path, game_id, detail from ingest_folders
    where status = 'imported' and detail is not null"
```

To list the imported games that are still hidden because a proxy is missing (the ingest log says
why each failed; a restart of the worker retries them right away):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db \
  psql -U app -d app -c "select g.id, f.folder_path from games g
    left join ingest_folders f on f.game_id = g.id where g.awaiting_proxies"
```

A chapter whose original is broken beyond encoding keeps failing: replace the file on Drive with a
good copy of the same length (the next retry encodes it), or delete the hidden game
(`delete from games where id = '<game id>'`) and then its folder's row to import the folder
afresh.

To add a late part to an accepted game, read its duration and frame rate in the ingest
container:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec ingest \
  ffprobe -v error -show_entries format=duration -of csv=p=0 '/media/source/<folder>/<file>'
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec ingest \
  ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of csv=p=0 \
  '/media/source/<folder>/<file>'
```

and append it after the game's last chapter, with the rate as the fraction ffprobe printed (for
example `50/1` becomes `50`, `60000/1001` becomes `60000.0/1001`):

```sql
insert into game_sources (game_id, order_index, file_path, duration_s, frame_rate)
select '<game id>', max(order_index) + 1, '<folder>/<file>', <duration>, <frame rate>
from game_sources where game_id = '<game id>';
```

Chapters imported before the worker recorded frame rates have `frame_rate` null, and B / N step
them as 25 fps footage, two frames at a time on 50 fps GoPro files. To backfill one, read its
rate with the second command above and set it:

```sql
update game_sources set frame_rate = <frame rate>
where game_id = '<game id>' and file_path = '<folder>/<file>';
```

A whole game recorded in one camera mode shares one rate, so `where game_id = '<game id>'` and
`frame_rate is null` backfills all its chapters at once.

The proxy loop then encodes its proxy, and the note clears on the next scan. Appending at the end
keeps every existing tag and clip in place, because game time only grows at the end.

Watch it with `docker compose ... logs -f ingest`; every import, rejection and proxy is one line.

### Switching an existing host over

1. Before the release that contains the worker is merged, make the compose changes above and add
   `ingest` to the `build` line of the host's `deploy.sh` (see
   [Continuous deployment](#continuous-deployment-from-github-actions)); without it, later
   deploys keep running the first ingest image. The deploy then runs the `ingest_folders`
   migration and starts the worker.
2. Check `docker compose ... logs ingest`: the first line after the start lists the folders it
   recorded as skipped.
3. Point the hand-entered games at Drive: their `game_sources.file_path` values are relative to the
   old media directory (for example `26-27-DTV-BWK/Viertel1.mp4`), while the clip worker now reads
   from the mount, where the same folder may be named differently (`26／27-DTV-BWK`). For each game
   folder, check that `ls "/mnt/hockey-drive/<drive name>"` lists the chapters, then run:

   ```sql
   update game_sources set file_path = replace(file_path, '<old folder>/', '<drive name>/')
   where file_path like '<old folder>/%';
   ```

   The player still plays these games from the media directory until step 4, so link the old
   folder under the new name right away, or the videos stop playing:
   `ln -s '<old folder>' '/srv/hockey/media/<drive name>'`. Cut one clip of that game to confirm
   the clip worker reads it from Drive.

4. Wait until the ingest log shows a proxy for every chapter, then set
   `MEDIA_PROXY_BASE_URL=https://<host>/media/proxy` in `.env` and restart the app. Set it only
   then: the player plays every game from the proxy root once it is set, and a Drive-imported game
   has no other playable copy, since its originals are not served. Once the games play from their
   proxies, delete the local originals and their links under `/srv/hockey/media`.

## 7. Media directory and `MEDIA_BASE_URL`

The app does **not** store video blobs in the database; `game_sources.file_path` holds a path and
the files are served under `MEDIA_BASE_URL`. Store `file_path` values **relative** to
`/srv/hockey/media` (e.g. `2026/hsv-vs-utho/q1.mp4`). Relative paths plus a fixed mount point are
exactly what makes the NAS migration a config change rather than a data rewrite.

nginx serves the media directory directly from the disk (section 8), so the app container does not
need the media mounted for playback. The tagging proxy is written into `/srv/hockey/media` by the
ingest worker, and finished clips are written there by the clip cut worker (this repo, ADR 0007);
originals stay on Google Drive (ADR 0008) and are never copied to the VPS.

## 8. nginx reverse proxy, TLS, and media serving

```bash
sudo apt -y install nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/hockey`:

```nginx
server {
    server_name hockey.example.com;              # your real domain

    # Large uploads if the app ever receives video directly; copy-cut outputs are small.
    client_max_body_size 4g;

    # App (Next.js standalone) behind the proxy.
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # Video files straight from the data disk. This URL is what MEDIA_BASE_URL points at.
    location /media/ {
        alias /srv/hockey/media/;
        autoindex off;                           # no directory listing - secret-link surfaces must not leak
        add_header X-Robots-Tag "noindex, nofollow" always;
        # Range requests for video scrubbing are on by default in nginx.
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hockey /etc/nginx/sites-enabled/hockey
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hockey.example.com       # obtains the cert and rewrites the server block to 443
```

certbot installs a renewal timer automatically; confirm with `systemctl list-timers | grep certbot`.

With this, set `MEDIA_BASE_URL=https://hockey.example.com/media` and
`NEXT_PUBLIC_APP_URL=https://hockey.example.com` in `.env`.

`autoindex off` and the `noindex` header keep the login-free share surfaces from leaking a file
listing - see the secret-link rule in `CLAUDE.md`.

## 9. Database backups

The database is small (tags and metadata, not video), so a nightly `pg_dump` to the data disk plus
an off-box copy is enough. Create `/home/<user>/hockey/app/scripts-ops/pg-backup.sh` on the server:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /home/<user>/hockey/app
ts="$(date +%Y%m%d-%H%M%S)"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-app}" "${POSTGRES_DB:-app}" | gzip > "/srv/hockey/backups/db-${ts}.sql.gz"
# keep 14 days
find /srv/hockey/backups -name 'db-*.sql.gz' -mtime +14 -delete
```

```bash
chmod +x /home/<user>/hockey/app/scripts-ops/pg-backup.sh
# nightly at 03:30, as <user>: crontab -e
30 3 * * * /home/<user>/hockey/app/scripts-ops/pg-backup.sh >> /srv/hockey/backups/backup.log 2>&1
```

Restore has to be exercised at least once before you rely on it (deployment.md database checklist):
`gunzip -c db-<ts>.sql.gz | docker compose ... exec -T db psql -U app -d app`.

## 10. Environment variables

Fill `.env` from `.env.example`; the same keys are validated by `.env.schema` and the
quality gate. For this VPS:

- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_APP_URL=https://hockey.example.com` (build-time, public - no secret)
- [ ] `DATABASE_URL=postgres://app:<password>@db:5432/app` (host `db` = the Compose service)
- [ ] `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` set to real values (used by the db service)
- [ ] `AUTH_SECRET=<random 32+ bytes>` (server-only)
- [ ] `AUTH_INVITE_CODE=<code>` if coach self-registration should be open, else leave unset
- [ ] `MEDIA_BASE_URL=https://hockey.example.com/media`
- [ ] `CLIP_MEDIA_ROOT=/srv/media` and `CLIP_OUTPUT_DIR=clips` (worker service only; the path is
      inside the container, where `/srv/hockey/media` is mounted)
- [ ] `MEDIA_SOURCE_ROOT=/media/source` (worker and ingest services; the Drive mount inside the
      container) and `MEDIA_PROXY_ROOT=/srv/media/proxy` (ingest service), set in the compose
      file as in section 6b
- [ ] `MEDIA_PROXY_BASE_URL=https://hockey.example.com/media/proxy`, only once every chapter has a
      proxy (section 6b)
- [ ] Optional: `TEAM_SHARE_TOKEN=<unguessable secret>` (a secret, never `NEXT_PUBLIC`). It only
      seeds the first team link into the database; the coach creates or replaces the link under
      Einstellungen > Teilen, and a later change here has no effect
- [ ] `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_STREET`, `LEGAL_OPERATOR_CITY` and
      `LEGAL_CONTACT_EMAIL` for the "Impressum" and "Datenschutz" pages, plus the optional
      `LEGAL_CONTACT_PHONE` and `LEGAL_HOSTING_PROVIDER` (see `.env.example`); while a required
      one is unset the pages show a notice instead of the operator's details

Never commit a real `.env*`; only `.env.example` is tracked. Rotate any secret that has ever been
pasted into a log or PR.

## 11. Disk-usage alert at 80 %

Video fills a 200 GB disk quietly. A one-game 1080p recording is roughly 4-12 GB depending on
bitrate and length, so budget for perhaps 15-40 games plus clips, and get warned before it is full.
Create `/home/<user>/hockey/app/scripts-ops/disk-alert.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
threshold=80
used="$(df --output=pcent /srv/hockey | tail -1 | tr -dc '0-9')"
if (( used >= threshold )); then
  logger -t hockey-disk "WARN: /srv/hockey at ${used}% (threshold ${threshold}%)"
  # optional: pipe a message to your alerting channel here
fi
```

```bash
chmod +x /home/<user>/hockey/app/scripts-ops/disk-alert.sh
# hourly, as <user>: crontab -e
0 * * * * /home/<user>/hockey/app/scripts-ops/disk-alert.sh
```

## Continuous deployment from GitHub Actions

Merging the `develop` -> `master` release PR deploys this host, with no SSH session of your own:
the `Deploy` workflow (`.github/workflows/deploy.yml`) waits for CI on `master` to pass and then
opens one SSH connection that runs the host's own deploy script.

The host keeps the deploy logic, because it carries this deployment's paths (the same reason
`docker-compose.prod.yml` is not committed). Create `/srv/hockey/deploy.sh`, owned by `<user>` and
executable:

```bash
#!/usr/bin/env bash
# Deploy origin/master (or the ref given as $1) on this host.
set -euo pipefail
cd /home/<user>/hockey/app
ref="${1:-origin/master}"
git fetch -q origin
git checkout -q --detach "$ref"
echo "deploying $(git log --oneline -1)"
compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
"${compose[@]}" build app migrate worker ingest
"${compose[@]}" up -d db
"${compose[@]}" --profile ops run --rm migrate
"${compose[@]}" up -d
"${compose[@]}" ps
```

### The CI key can only deploy

Generate a keypair used for nothing else, and install the public half with a **forced command**, so
the key cannot open a shell, forward a port, or deploy any ref other than `master`:

```bash
# on your machine
ssh-keygen -t ed25519 -C "github-actions deploy" -f ~/.ssh/gha-deploy

# on the VPS, appended to /home/<user>/.ssh/authorized_keys as one line:
restrict,command="/srv/hockey/deploy.sh" ssh-ed25519 AAAA... github-actions deploy
```

`restrict` disables port, agent and X11 forwarding and pty allocation; `command=` replaces whatever
the client asks for with the deploy script, ignoring its arguments. Verify both before trusting it -
this must print the deploy output, not `<user>`:

```bash
ssh -i ~/.ssh/gha-deploy <user>@<host> whoami
```

### Repository secrets and variables

| Name                 | Kind     | Value                                                        |
| -------------------- | -------- | ------------------------------------------------------------ |
| `DEPLOY_SSH_KEY`     | secret   | the **private** key generated above                          |
| `DEPLOY_KNOWN_HOSTS` | secret   | `ssh-keyscan <host>` output, so the runner pins the host key |
| `DEPLOY_HOST`        | secret   | the VPS address                                              |
| `DEPLOY_USER`        | secret   | the login user `<user>` from step 1                          |
| `PRODUCTION_URL`     | variable | `https://hockey.example.com`, shown on the deployment        |

Delete your local copy of the private key once it is stored as a secret; GitHub cannot show it
again, and the host only ever needs the public half.

### Operating it

- **Normal release:** merge the release PR into `master`. CI runs, then `Deploy` runs. Watch it
  under the repository's Actions tab.
- **Re-deploy without a new commit** (a host change, a rolled-back image): run the `Deploy`
  workflow manually with `workflow_dispatch`.
- **Roll back:** SSH in and run the script with an explicit ref - `/srv/hockey/deploy.sh <previous-sha>`.
  CI never deploys anything but `master`, so a rollback is deliberately a human action.
- **Require an approval before each deploy:** add required reviewers to the `production`
  environment in the repository settings. The job then waits for a human, which is worth doing once
  the app carries data you would miss.

## Migrating to the NAS later

When the NAS arrives, the roles in ADR 0003 split back apart with minimal churn, because `db/` and
`media/` were kept separate under one fixed mount:

1. Mount the NAS share (SMB/NFS) on the VPS, e.g. at `/mnt/nas/hockey-media`.
2. Stop writes, then `rsync -a /srv/hockey/media/ /mnt/nas/hockey-media/`.
3. Repoint media at the NAS **without touching the database**: either bind-mount the NAS path at
   `/srv/hockey/media` (so `file_path` values and `MEDIA_BASE_URL` stay identical), or change the
   nginx `alias` to the NAS path. Relative `file_path` values mean no DB rewrite either way.
4. The database data directory stays on the VPS (`/srv/hockey/db`) - the VPS keeps its
   always-on coordination role; the NAS takes over cold storage only.

## See also

- [ADR 0003 - hardware role split](../decisions/0003-hardware-role-split.md) (why the VPS only does
  `-c copy` cuts and the NAS owns cold storage)
- [deployment.md](deployment.md) (the generic multi-target runbook this file specializes)
- [google-drive-mount.md](google-drive-mount.md) (the read-only Drive mount that holds the
  originals per ADR 0008)
- [local-development.md](local-development.md) (running it all locally, no VPS)
