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
- **Login user:** `yannik` (sudo-capable, non-root; root login disabled after setup).
- **Runtime:** Docker Compose (the repo ships `Dockerfile` + `docker-compose.yml`).
- **Reverse proxy / TLS:** nginx + certbot (Let's Encrypt).
- **Data disk:** a 200 GB block device mounted at `/srv/hockey`, holding both the database data
  directory and the video files. When the NAS arrives, only the media directory moves; the
  database stays on the VPS.

The one hard rule from ADR 0003 survives the collapse: **the VPS only ever cuts clips with
`ffmpeg -c copy` (no re-encoding).** Any re-encoding, audio double-whistle analysis, or ML runs as
a batch job on the M4, never here. Copy-cuts are I/O-bound, not CPU-bound, so they will not peg the
small VPS.

## Directory layout on the data disk

```
/srv/hockey/
  db/       # PostgreSQL data directory (bind-mounted into the db container)
  media/    # raw source videos + finished clips (game_sources.file_path is relative to here)
  backups/  # nightly pg_dump output
```

Keeping `db/` and `media/` as siblings under one mount is what makes the later NAS migration a
mount swap instead of a data migration: you move `media/` to the NAS mount and leave `db/`
untouched.

---

## 1. Base OS and the `yannik` user

Run the first block as `root` (or via the provider's console) to create the login user, then do
everything else as `yannik`.

```bash
# as root
adduser --gecos "" yannik
usermod -aG sudo yannik

# install the operator's public key for yannik (paste the key, do not reuse root's)
install -d -m 700 -o yannik -g yannik /home/yannik/.ssh
# ... write the public key into /home/yannik/.ssh/authorized_keys, then:
chown yannik:yannik /home/yannik/.ssh/authorized_keys
chmod 600 /home/yannik/.ssh/authorized_keys
```

Verify you can SSH in as `yannik` with the key **before** locking root out. Then harden SSH:

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

Create the layout and hand it to `yannik`:

```bash
sudo mkdir -p /srv/hockey/{db,media,backups}
sudo chown -R yannik:yannik /srv/hockey/media /srv/hockey/backups
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

sudo usermod -aG docker yannik   # log out and back in for this to take effect
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
sudo -u yannik -i
git clone https://github.com/spockey4711/hockey-video-analysis.git /srv/hockey/app
cd /srv/hockey/app
git checkout master            # deploy the promoted, always-deployable branch

cp .env.example .env.production
# fill in .env.production (see the checklist in section 9), then:

docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Roll back by checking out the previous tag/SHA and re-running the `up -d --build` line - keep the
last known-good commit noted somewhere.

## 6. Media directory and `MEDIA_BASE_URL`

The app does **not** store video blobs in the database; `game_sources.file_path` holds a path and
the files are served under `MEDIA_BASE_URL`. Store `file_path` values **relative** to
`/srv/hockey/media` (e.g. `2026/hsv-vs-utho/q1.mp4`). Relative paths plus a fixed mount point are
exactly what makes the NAS migration a config change rather than a data rewrite.

nginx serves the media directory directly from the disk (section 7), so the app container does not
need the media mounted for playback. Raw videos and finished clips are written into
`/srv/hockey/media` by the pipeline / cut-worker (the sibling `hockey-video-pipeline` repo); that
directory is the shared integration surface ADR 0003 calls for. For the transitional single-server
setup, placing files there by `scp`/`rsync` is fine.

## 7. nginx reverse proxy, TLS, and media serving

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

## 8. Database backups

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
# nightly at 03:30, as yannik: crontab -e
30 3 * * * /srv/hockey/app/scripts-ops/pg-backup.sh >> /srv/hockey/backups/backup.log 2>&1
```

Restore has to be exercised at least once before you rely on it (deployment.md database checklist):
`gunzip -c db-<ts>.sql.gz | docker compose ... exec -T db psql -U app -d app`.

## 9. Environment variables

Fill `.env.production` from `.env.example`; the same keys are validated by `.env.schema` and the
quality gate. For this VPS:

- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_APP_URL=https://hockey.example.com` (build-time, public - no secret)
- [ ] `DATABASE_URL=postgres://app:<password>@db:5432/app` (host `db` = the Compose service)
- [ ] `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` set to real values (used by the db service)
- [ ] `AUTH_SECRET=<random 32+ bytes>` (server-only)
- [ ] `AUTH_INVITE_CODE=<code>` if coach self-registration should be open, else leave unset
- [ ] `MEDIA_BASE_URL=https://hockey.example.com/media`
- [ ] `TEAM_SHARE_TOKEN=<unguessable secret>` (a secret, never `NEXT_PUBLIC`)

Never commit a real `.env*`; only `.env.example` is tracked. Rotate any secret that has ever been
pasted into a log or PR.

## 10. Disk-usage alert at 80 %

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
# hourly, as yannik: crontab -e
0 * * * * /srv/hockey/app/scripts-ops/disk-alert.sh
```

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
- [local-development.md](local-development.md) (running it all locally, no VPS)
