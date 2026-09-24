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
git clone https://github.com/spockey4711/hockey-video-analysis.git /srv/hockey/app
cd /srv/hockey/app
git checkout master            # deploy the promoted, always-deployable branch

cp .env.example .env.production
# fill in .env.production (see the checklist in section 10), then:

docker compose --env-file .env.production \
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
    - .env.production
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
    - .env.production
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
under the media directory, so Caddy serves them at `/media/proxy/...` with no extra configuration.

What the worker does, every two minutes:

- **Game folders** are the folders directly under the Drive root. A folder that has no
  `ingest_folders` row is new. It is imported only after its file list has not changed for
  `INGEST_QUIET_MINUTES` (default 120), because Drive shows each file only once it is fully
  uploaded and a whole game takes hours to upload.
- **Parts** are the files named `halbzeit<N>`, `viertel<N>` (`.mp4`/`.mov`) or GoPro
  `GX<CC><NNNN>.MP4` / `GH<CC><NNNN>.MP4`, case-insensitive, ordered by N (GoPro: by recording,
  then chapter). Any other file (a goal clip, a photo) is ignored. A folder that mixes the schemes,
  repeats a part or skips a number is recorded as `rejected` with the reason; a folder with no
  parts at all is left waiting.
- **Registering** reads each part's duration and the recording date with ffprobe through the
  mount (a few byte ranges, not the whole file) and creates the game in the needs-a-name state. A
  date is taken only from a plausible camera `creation_time`; otherwise it is left for the coach.
- **Proxies**: every chapter in `game_sources` should have a proxy at the same relative path under
  `MEDIA_PROXY_ROOT`. The worker encodes the newest missing one at a time, at `nice -n 19` with
  `INGEST_PROXY_THREADS` threads (default 2), checks that it lasts as long as the original, and
  only then moves it into place. That also backfills proxies for games entered by hand, as long as
  their chapters are found under `MEDIA_SOURCE_ROOT`.

On its very first run, when `ingest_folders` is still empty, the worker records every folder
already on Drive as `skipped` instead of importing it, so games entered by hand do not appear
twice. To make the worker look at a folder again (a rejected folder that has been fixed, or a
skipped one that should be imported after all), delete its row:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db \
  psql -U app -d app -c "delete from ingest_folders where folder_path = '<name>'"
```

Watch it with `docker compose ... logs -f ingest`; every import, rejection and proxy is one line.

### Switching an existing host over

1. Deploy the release that contains the worker (`deploy.sh` runs the `ingest_folders` migration),
   with the compose changes above.
2. Check `docker compose ... logs ingest`: the first line after the start lists the folders it
   recorded as skipped.
3. Point the hand-entered games at Drive: their `game_sources.file_path` values are relative to the
   old media directory (for example `26-27-DTV-BWK/Viertel1.mp4`), while the clip worker now reads
   from the mount, where the same folder may be named differently (`26／27-DTV-BWK`). For each game
   folder, check that `ls "/mnt/hockey-drive/<drive name>"` lists the chapters, then
   `update game_sources set file_path = replace(file_path, '<old folder>/', '<drive name>/') where
file_path like '<old folder>/%';`. Cut one clip of that game to confirm, then delete the local
   copy of the originals under `/srv/hockey/media/<old folder>`.
4. Wait until the ingest log shows a proxy for every chapter, then set
   `MEDIA_PROXY_BASE_URL=https://<host>/media/proxy` in `.env` and restart the app. Set it only
   then: the player plays every game from the proxy root once it is set, and a Drive-imported game
   has no other playable copy, since its originals are not served.

## 7. Media directory and `MEDIA_BASE_URL`

The app does **not** store video blobs in the database; `game_sources.file_path` holds a path and
the files are served under `MEDIA_BASE_URL`. Store `file_path` values **relative** to
`/srv/hockey/media` (e.g. `2026/hsv-vs-utho/q1.mp4`). Relative paths plus a fixed mount point are
exactly what makes the NAS migration a config change rather than a data rewrite.

nginx serves the media directory directly from the disk (section 8), so the app container does not
need the media mounted for playback. Raw videos and finished clips are written into
`/srv/hockey/media` by the pipeline / cut-worker (the sibling `hockey-video-pipeline` repo); that
directory is the shared integration surface ADR 0003 calls for. For the transitional single-server
setup, placing files there by `scp`/`rsync` is fine.

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
`NEXT_PUBLIC_APP_URL=https://hockey.example.com` in `.env.production`.

`autoindex off` and the `noindex` header keep the login-free share surfaces from leaking a file
listing - see the secret-link rule in `CLAUDE.md`.

## 9. Database backups

The database is small (tags and metadata, not video), so a nightly `pg_dump` to the data disk plus
an off-box copy is enough. Create `/srv/hockey/app/scripts-ops/pg-backup.sh` on the server:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /srv/hockey/app
ts="$(date +%Y%m%d-%H%M%S)"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-app}" "${POSTGRES_DB:-app}" | gzip > "/srv/hockey/backups/db-${ts}.sql.gz"
# keep 14 days
find /srv/hockey/backups -name 'db-*.sql.gz' -mtime +14 -delete
```

```bash
chmod +x /srv/hockey/app/scripts-ops/pg-backup.sh
# nightly at 03:30, as <user>: crontab -e
30 3 * * * /srv/hockey/app/scripts-ops/pg-backup.sh >> /srv/hockey/backups/backup.log 2>&1
```

Restore has to be exercised at least once before you rely on it (deployment.md database checklist):
`gunzip -c db-<ts>.sql.gz | docker compose ... exec -T db psql -U app -d app`.

## 10. Environment variables

Fill `.env.production` from `.env.example`; the same keys are validated by `.env.schema` and the
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
- [ ] `TEAM_SHARE_TOKEN=<unguessable secret>` (a secret, never `NEXT_PUBLIC`)

Never commit a real `.env*`; only `.env.example` is tracked. Rotate any secret that has ever been
pasted into a log or PR.

## 11. Disk-usage alert at 80 %

Video fills a 200 GB disk quietly. A one-game 1080p recording is roughly 4-12 GB depending on
bitrate and length, so budget for perhaps 15-40 games plus clips, and get warned before it is full.
Create `/srv/hockey/app/scripts-ops/disk-alert.sh`:

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
chmod +x /srv/hockey/app/scripts-ops/disk-alert.sh
# hourly, as <user>: crontab -e
0 * * * * /srv/hockey/app/scripts-ops/disk-alert.sh
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
cd /srv/hockey/app
ref="${1:-origin/master}"
git fetch -q origin
git checkout -q --detach "$ref"
echo "deploying $(git log --oneline -1)"
compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
"${compose[@]}" build app migrate worker
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
- **Roll back:** SSH in and run the script with an explicit ref - `~/hockey/deploy.sh <previous-sha>`.
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
