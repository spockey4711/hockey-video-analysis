# 0003 - Split work across M4, VPS and NAS by cost profile

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none (amended by
  [ADR 0007](0007-clip-worker-lives-in-the-app-repo.md), which moves the clip cut worker's _code_
  into this repo; the hardware split below is unchanged, and by
  [ADR 0008](0008-google-drive-holds-originals.md), which replaces the NAS with Google Drive for the
  originals and lets the VPS encode the tagging proxy, and by
  [ADR 0013](0013-native-mac-app-is-the-coachs-editing-desk.md), under which the M4, as the native
  Mac app, also copy-cuts the clips of the games it registers and encodes their browser copy)

## Context

The project runs on three machines with very different strengths: a MacBook Pro M4 Pro (strong
CPU/GPU, Apple Silicon with MPS/CoreML, but not always on), a small always-on VPS (12 GB RAM,
~8 GB free, but sustained CPU load is undesirable), and a NAS (cheap bulk storage). Video work
divides cleanly into always-on coordination, occasional heavy compute, and bulk storage, and the
PRD is explicit that the VPS must not carry continuous encoding load (PRD s4).

## Decision

We assign each responsibility to the machine whose cost profile fits it:

- **VPS** - always-on coordination: the app server, the database, job queue, serving clips behind a
  reverse proxy, and only light `ffmpeg -c copy` cuts (no re-encoding).
- **M4** - occasional heavy compute run as batch jobs: audio double-whistle analysis, any optional
  re-encoding, and later ML/YOLO. It need not be always on; jobs take video in and hand
  timestamps/clips back.
- **NAS** - cold storage: raw source videos and finished clips.

The guiding principle: the VPS coordinates and only ever cuts without re-encoding; anything
compute-intensive is a batch job on the M4 (video in -> candidate timestamps / clips out).

Alternatives rejected: doing everything on the VPS (encoding would peg a small shared server) and
doing everything on the M4 (not always on, so it cannot host the app or serve links reliably).

## Consequences

- The VPS stays responsive and cheap; no background job can starve the app or the DB.
- Heavy jobs depend on the M4 being awake, so anything requiring re-encoding or audio analysis is
  inherently asynchronous and best-effort in timing, not interactive.
- Work crosses machine boundaries, so components communicate through shared state (the DB queue)
  and shared storage (the NAS) rather than in-process calls; paths and the job queue are the
  integration surface.
- Where the cut-worker itself runs (NAS-Docker vs. the worker reading NAS over SMB from the VPS/M4)
  is left open until the NAS type is known (PRD risk 4).
