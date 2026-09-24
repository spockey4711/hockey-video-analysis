# Google Drive mount - read-only access to the originals

The original recordings live on Google Drive ([ADR 0008](../decisions/0008-google-drive-holds-originals.md)).
The VPS reads them through a Google Cloud service account and an rclone mount that is read-only
end to end: the service account is only a **Viewer** on the Drive folder, rclone asks for the
`drive.readonly` scope, and the mount itself is `--read-only`. Nothing on the VPS can change,
move or delete an original.

This is set up on the production VPS as of 2026-09-24. Repeat these steps to rebuild the host or
to rotate the key.

## What is where

| Piece                | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Google Cloud project | `hockey-video-analysis` (owned by the Drive owner's Google account)              |
| Service account      | `drive-reader@hockey-video-analysis.iam.gserviceaccount.com`, no Cloud IAM roles |
| Drive root           | folder ID `<drive-root-folder-id>`, shared with the service account as Viewer    |
| Key on the VPS       | `/etc/rclone/drive-reader.json` (root, `600`)                                    |
| rclone config        | `/etc/rclone/rclone.conf` (root, `600`), remote `hockey-drive:`                  |
| Mount                | `/mnt/hockey-drive`, systemd unit `rclone-hockey-drive.service`                  |
| VFS cache            | `/var/cache/rclone`, capped at 20 GB, entries expire after 24 h                  |

The key is a secret like `DATABASE_URL`: it lives only on the VPS, never in the repo, in `.env`
files or in a synced folder. If one ever leaks, delete it under the service account's **Keys** tab
and make a new one. Treat the Drive root's folder ID the same way while the folder is also shared
by link: anyone holding the ID can open the videos, so it is recorded only in
`/etc/rclone/rclone.conf` on the VPS.

## Drive layout

One folder per game directly under the root; the folder holds that game's recording files. Loose
files in the root (for example a PDF) are not games. Folder names may contain `/` (such as
`26/27-DTV-BWK`), which rclone shows as a full-width `／`, so the ingest worker identifies game
folders by their Drive folder ID, never by name.

## 1. Service account (Google Cloud Console)

Signed in as the Drive folder's owner:

1. Create the project `hockey-video-analysis` (no organization needed).
2. Enable the **Google Drive API** for it.
3. Under **IAM & Admin > Service accounts**, create `drive-reader`. Grant it no roles.
4. On `drive-reader`, **Keys > Add key > Create new key > JSON**. The JSON file downloads.
5. In Drive, share the root folder with the service account's email as **Viewer**, without
   notification. Do not rely on "anyone with the link": the explicit share keeps working if link
   sharing is turned off.

Check access from any machine with rclone, without writing a config:

```bash
rclone lsf --max-depth 2 --drive-scope drive.readonly \
  --drive-service-account-file ./drive-reader.json \
  --drive-root-folder-id <drive-root-folder-id> :drive:
```

## 2. rclone and the mount (VPS, as root)

Install rclone from the official package (the Ubuntu archive lags far behind):

```bash
curl -fsSLo rclone.deb https://downloads.rclone.org/rclone-current-linux-amd64.deb
apt-get install -y ./rclone.deb
```

Copy the key to the VPS (`scp`, then `install -m 600 -o root -g root ... /etc/rclone/drive-reader.json`)
and delete every other copy of it. Then create `/etc/rclone/rclone.conf` (mode `600`):

```ini
[hockey-drive]
type = drive
scope = drive.readonly
service_account_file = /etc/rclone/drive-reader.json
root_folder_id = <drive-root-folder-id>
```

And `/etc/systemd/system/rclone-hockey-drive.service`:

```ini
[Unit]
Description=Read-only rclone mount of the hockey Google Drive root (ADR 0008)
Wants=network-online.target
After=network-online.target

[Service]
Type=notify
ExecStartPre=/usr/bin/mkdir -p /mnt/hockey-drive /var/cache/rclone
ExecStart=/usr/bin/rclone mount hockey-drive: /mnt/hockey-drive \
  --config /etc/rclone/rclone.conf \
  --read-only \
  --allow-other \
  --umask 022 \
  --vfs-cache-mode full \
  --vfs-cache-max-size 20G \
  --vfs-cache-max-age 24h \
  --cache-dir /var/cache/rclone \
  --dir-cache-time 5m \
  --poll-interval 1m \
  --log-level NOTICE
ExecStop=/usr/bin/fusermount3 -uz /mnt/hockey-drive
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now rclone-hockey-drive.service
```

Why these flags:

- `--vfs-cache-mode full` caches only the byte ranges that are read, so an ffprobe or a copy-cut
  seek does not download a whole 4 GB chapter. The cache is capped at 20 GB and aged out after a
  day.
- `--allow-other` lets the container users read the mount; the mount runs as root.
- `--dir-cache-time 5m` bounds how long a newly uploaded folder stays invisible. Polling the
  root in minutes keeps Drive API use far below quota.

## 3. Verify

As the login user, not root:

```bash
ls /mnt/hockey-drive                      # the game folders
touch /mnt/hockey-drive/x                 # must fail: Read-only file system
dd if="/mnt/hockey-drive/<game>/<file>.mp4" of=/dev/null bs=1M skip=1500 count=8
                                          # a seek deep into a file returns in about a second
```

Inside a container, the way the workers will read it:

```bash
docker run --rm -v /mnt/hockey-drive:/media/source:ro,rslave --entrypoint ffprobe \
  linuxserver/ffmpeg:latest -v error -show_entries format=duration -of default=nw=1 \
  "/media/source/<game>/<file>.mp4"
```

Bind-mount it into containers with `rslave` propagation, so a container keeps seeing the files
after the rclone service restarts and remounts.

## Operating it

```bash
systemctl status rclone-hockey-drive      # is it mounted
journalctl -u rclone-hockey-drive -n 50   # errors (auth, quota, network)
du -sh /var/cache/rclone                  # cache size, stays under the 20 GB cap
```

If Drive is unreachable, reads through the mount fail: a clip cut fails like a missing file and
can be re-queued, while already-cut clips and proxies keep working because they live on the VPS
disk.
