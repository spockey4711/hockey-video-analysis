# Roadmap: open-source auto camera for field hockey

- **Created:** 2026-09-24
- **Horizon:** 12 months, 2026-09-28 to 2027-09-26
- **Capacity:** one developer. The committed pace is ~10 h/week -> 26 two-week sprints of ~20 h
  (~520 h total, ~400 h planned, the rest is buffer). Each sprint can stretch to 40 h/week (~80 h)
  through its optional stretch items.
- **Basis:** the research note [`../research/auto-camera-landscape.md`](../research/auto-camera-landscape.md)

## Goal

Turn this app into the platform half of an open-source, Veo-style camera for field hockey: two
action cameras on a mast, a stitched panorama, and an automatic virtual camera that follows play,
rendered as a batch job on the M4 and ingested as the game's source video. Stitching, tracking and
the virtual camera are reused from `reco-project/video-stitcher` (AGPL-3.0), called as a separate
executable, not rebuilt. The app keeps doing what it does today: tagging, clips, sharing. The year
ends with a public release that another club can set up without us.

## How to use this plan

- Tick a box when its item is done, in the same PR as the work. Sprint dates are targets, not
  deadlines. When a sprint slips, move its open items forward rather than rewriting the plan.
- Every sprint has a **core** list (sized for 10 h/week) and a **stretch** list that fills the
  sprint up to 40 h/week. The core list always comes first. Stretch items stay on the sprint's
  topic, deepen it, and are pulled in the listed order when there is time left. They never pull
  work from a later sprint, so the plan keeps its shape at any pace. Stretch items still open at
  the end of a sprint are dropped, not carried over; re-list one later if it still matters.
- This file is the long view. When a sprint starts, promote its items to numbered tasks in
  [`backlog.md`](backlog.md), which stays the source of truth for what is being built. Items that
  already exist there (P2-8, P2-9, P2-17, P2-18, P2-19) are referenced by id.
- Revisit the whole plan at each decision gate below.

## Season constraint

Outdoor footage can only be recorded during the field season. Assumption: the autumn half ends
mid/late October and the season resumes in April; winter is indoor hockey. So the feasibility spike
runs now, and every game until the break is filmed with both cameras to build a footage bank. The
winter work (tuning, labelling, ball model) runs on that footage. Real-world validation waits for
April.

## Decision gates

| Sprint | Gate                                                  | If it fails                                                                       |
| ------ | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| S2     | Spike: is player-cluster framing watchable on the M4? | Replace phases C-E with a single wide-angle camera plan, or stop the auto camera. |
| S14    | Does a fine-tuned ball model beat the default model?  | Keep player-cluster framing; the freed sprint becomes buffer.                     |
| S18    | Multi-team install, or one install per club?          | "One install per club" shrinks S19 to almost nothing.                             |

## Phase A - Spike and footage bank (S1-S2, October)

### S1 (2026-09-28 to 2026-10-11) - Hardware and first recording

- [ ] Get a second GoPro, same model and firmware as the first
- [ ] Arrange a 5-6 m mount (telescopic mast, stand roof, or balcony) and clear it with the club
- [ ] Build a dual mount that keeps both cameras as close together as possible
- [ ] Write a recording checklist: 4K, 50 fps, same lens mode, a clap at start and end
- [ ] Install `reco-cli` v0.5.4 `macos-arm64` and `yolo26n.onnx` on the M4
- [ ] Record one training session, at least 10 minutes
- [ ] Run calibration and draw the field polygon

**Stretch (up to 40 h/week)**

- [ ] Record the same drill with two lens modes (for example Wide vs Linear) and two mount heights
- [ ] Power for a full game: external battery, cable routing, a weatherproof case
- [ ] Read reco's tracking source (`FieldPannerConfig`, the ball tracker) and note the tuning knobs
- [ ] Start a hardware notes file (parts, prices, photos) that later feeds the S23 guide

### S2 (2026-10-12 to 2026-10-25) - Measure and decide

- [ ] Render 10 minutes with `--tracking field` and measure speed (x real time)
- [ ] Rate the stitch seam (ghosting, misalignment)
- [ ] Annotate 100 frames by hand and compute ball recall per pitch third
- [ ] Rate Action vs FrameAll framing 1-5 for open play, a penalty corner and a long ball
- [ ] Write the results as a follow-up note in `docs/research/`, as a PR
- [ ] **Go/no-go decision** (gate S2)
- [ ] Footage bank: film every game until the season break with both cameras, target at least 4

**Stretch (up to 40 h/week)**

- [ ] Grow the spike sample to 500 annotated frames for a firmer recall number
- [ ] Compare 4K30 vs 4K50/60 and several `--detection-interval` values on speed and quality
- [ ] Render a full game end to end and log battery, heat and file sizes
- [ ] Organise the footage bank: storage (external SSD), folder naming, a per-game metadata sheet
- [ ] Raise the footage-bank target to 8 games, training sessions included

## Phase B - Finish the ingest path (S3-S5, November to early December)

The follow-cam render will enter the app through this path, and it is needed anyway.

### S3 (2026-10-26 to 2026-11-08) - P2-17 Drive import, part 1

- [ ] Collect P2-17's prerequisites: service account, Drive root name and folder layout, rclone
      setup by agent or by hand
- [ ] Refine P2-17 and fix its owned paths
- [ ] Detect new game folders on Drive
- [ ] Sort chapters and create `game_sources` rows, with tests
- [ ] Trigger the proxy encode on the VPS

**Stretch (up to 40 h/week)**

- [ ] Write the `docs/ops/` guide for the service account, rclone mount and cache cap
- [ ] Integration tests against a fake Drive folder tree on local disk
- [ ] Split `CLIP_MEDIA_ROOT` into a read-only source root and a clip output root (part of P2-17)

### S4 (2026-11-09 to 2026-11-22) - P2-17 part 2 and P2-18

- [ ] Handle failure cases: half-finished uploads, duplicate imports
- [ ] End-to-end test with a real game
- [x] P2-18: review list for newly imported games (title, date, opponent)
- [ ] Update the docs and the coach guide

**Stretch (up to 40 h/week)**

- [ ] Show import and proxy-encode progress to the coach
- [ ] Automated browser test of the import-review flow
- [ ] Coach-guide screenshots of the new flow

### S5 (2026-11-23 to 2026-12-06) - Close P2-9 and P2-19

- [ ] P2-9: close its remaining steps (completed by P2-17)
- [ ] P2-19: fix the pen and fullscreen buttons in a narrow window
- [ ] Walk the whole flow with a footage-bank game: recording to shared link

**Stretch (up to 40 h/week)**

- [ ] Check the watch and share pages at phone, laptop and desktop widths and fix what looks off
- [ ] Pick off P2-8 design-gap items along the tested flow
- [ ] Measure proxy start-up and seek times on a long game and fix the worst offender

## Phase C - Render job on the M4 (S6-S9, December to January)

### S6 (2026-12-07 to 2026-12-20) - Architecture

- [ ] ADR 0009: "The follow-cam render is the game's source" (touches ADRs 0002, 0003, 0004, 0008)
- [ ] Decide where the render job lives: `hockey-video-pipeline` (recommended) or this repo
- [ ] Define the folder convention: `left/`, `right/`, `rig.json`
- [ ] Check the data model: how does the app know a game is a follow-cam game?

**Stretch (up to 40 h/week)**

- [ ] Throwaway end-to-end prototype (shell script: reco, then upload) to test the ADR before
      building it properly
- [ ] Document reco's CLI contract: flags, exit codes, the `--events` JSONL format
- [ ] Verify whether reco orders GoPro chapter files correctly and handles drift, and report findings
      upstream

### S7 (2026-12-21 to 2027-01-03) - Buffer (holidays)

- [ ] Finish open items from S6

**Stretch (up to 40 h/week)**

- [ ] Upstream contribution to reco from the S6 findings (issue or PR)
- [ ] Curate the footage bank: cut out warm-ups and breaks, tag set pieces for later evaluation

### S8 (2027-01-04 to 2027-01-17) - Render job, part 1

- [ ] Wrapper around `reco-cli`: pin the version, check the install
- [ ] Store and reuse the calibration per rig
- [ ] Read both chapter sets, write one MP4
- [ ] Tests with a short sample clip

**Stretch (up to 40 h/week)**

- [ ] Resume after a crash or sleep instead of restarting a 70-minute render
- [ ] Queue several games and render them one after another unattended
- [ ] Show render status in the app (queued, rendering, done, failed)

### S9 (2027-01-18 to 2027-01-31) - Render job, part 2

- [ ] Check clock drift against the start and end claps, warn above a threshold
- [ ] Drop the output into the Drive import folder so it flows in through phase B
- [ ] Progress and error log
- [ ] Render every game in the footage bank

**Stretch (up to 40 h/week)**

- [ ] Correct drift instead of only warning (audio cross-correlation over segments)
- [ ] Optionally keep the full panorama in the archive for later re-framing
- [ ] Benchmark render settings on the M4 and pick defaults (resolution, detection interval, backend)

## Phase D - Hockey tuning and ball model (S10-S14, February to early April)

### S10 (2027-02-01 to 2027-02-14) - Evaluation set

- [ ] Pick a labelling tool (CVAT or Label Studio)
- [ ] Label ~500 frames from 3 games: the ball, and where the camera should have looked
- [ ] Evaluation script: ball recall and framing error as one score

**Stretch (up to 40 h/week)**

- [ ] Grow the evaluation set to ~1,500 frames across all footage-bank games
- [ ] Write a labelling guide (what counts as visible, occluded, out of play)
- [ ] One command that renders a game and prints the score, so tuning runs are cheap

### S11 (2027-02-15 to 2027-02-28) - Tune the framing

- [ ] Sweep `FieldPannerConfig` systematically against the evaluation set
- [ ] Hockey presets: open play, penalty corner, play around the circle
- [ ] Measure before and after, record it in a research note

**Stretch (up to 40 h/week)**

- [ ] Side-by-side viewer to compare two renders of the same game
- [ ] If the config alone falls short: prototype hockey-specific director logic and offer it upstream
- [ ] Detect set pieces (penalty corner) and zoom accordingly

### S12 (2027-03-01 to 2027-03-14) - Ball model, data

- [ ] Label ~2,000 more ball frames from the footage bank, hard frames first
- [ ] Check the Roboflow dataset (license, perspective) for mixing in
- [ ] Split train and test by game, not by frame

**Stretch (up to 40 h/week)**

- [ ] Model-assisted pre-labels and interpolation between keyframes to speed up labelling
- [ ] Double the labelled set to ~4,000 frames
- [ ] Prepare the dataset for an open release (license, consent, datasheet)

### S13 (2027-03-15 to 2027-03-28) - Ball model, training

- [ ] Pick an Apache-licensed base model (for example RF-DETR)
- [ ] Fine-tune on the M4 and export to ONNX
- [ ] Plug it into reco as a custom model with the `ball` label
- [ ] Compare against the default model on the evaluation set

**Stretch (up to 40 h/week)**

- [ ] Tiled inference on the full-resolution panorama for the 2-5 px ball
- [ ] Try a multi-frame small-ball detector (WASB-SBDT style) as a second candidate
- [ ] Hyperparameter search within the M4's time budget

### S14 (2027-03-29 to 2027-04-11) - Integrate or drop

- [ ] If better: add the model to the render job, versioned (gate S14)
- [ ] If not: record the result and stay with player-cluster framing
- [ ] Update the recording checklist for the new field season

**Stretch (up to 40 h/week)**

- [ ] Publish the model weights with a model card (data, license, known limits)
- [ ] Offer the hockey model to reco as an optional preset
- [ ] Rebuild the mount from the winter's lessons before the first game

## Phase E - Field-season pilot (S15-S17, April to May)

### S15-S17 (2027-04-12 to 2027-05-23) - Pilot with our own team

- [ ] Run every game through the normal flow: record, render, import, tag, share
- [ ] Log per game what got in the way: setup time, errors, render time, coach feedback
- [ ] File the top three problems as backlog tasks and fix them
- [ ] Check the mast for wind and safety, update the guide
- [ ] Collect feedback from players and parents on the shared links

**Stretch (up to 40 h/week)**

- [ ] Win a second team in the club as a beta tester and support their setup
- [ ] Fix the next problems on the list beyond the top three
- [ ] Cut render time (settings, model size) so a game is ready the same evening
- [ ] Faster offload from the cameras (Wi-Fi offload or a card-reader routine)

## Phase F - Ready the app for other teams (S18-S21, May to July)

### S18 (2027-05-24 to 2027-06-06) - Ground rules

- [ ] ADR: license (recommendation: AGPL-3.0)
- [ ] ADR: multi-team install or one install per club (gate S18)
- [ ] Add `LICENSE`, drop `"private": true` from `package.json`

**Stretch (up to 40 h/week)**

- [ ] Have the license choice and third-party licenses (reco, model weights) checked
- [ ] Contributor guide for outsiders, code of conduct, issue and PR templates
- [ ] Governance note: who merges, how releases are cut

### S19 (2027-06-07 to 2027-06-20) - Multiple teams (small if "one install per club")

- [ ] Schema migration: `teams` table with its own share token
- [ ] Move `TEAM_SHARE_TOKEN` from the env into the database
- [ ] Scope coach access to their own team, with tests
- [ ] Verify share links still never expose another team's or player's clips

**Stretch (up to 40 h/week)**

- [ ] Club -> teams hierarchy with roles (head coach, assistant)
- [ ] Team admin page: create a team, invite coaches, rotate the share token
- [ ] Per-team invite codes instead of the global `AUTH_INVITE_CODE`

### S20 (2027-06-21 to 2027-07-04) - Pluggable storage

- [ ] Define a storage interface
- [ ] Implementations for local disk and S3-compatible storage
- [ ] Put Drive behind the same interface
- [ ] Amend ADR 0008

**Stretch (up to 40 h/week)**

- [ ] Migration tool to move a club's media between storage backends
- [ ] Retention policy: delete originals and proxies after N months, keep clips
- [ ] Signed, expiring URLs for S3-backed clips

### S21 (2027-07-05 to 2027-07-18) - Clean-up

- [ ] Remove personal paths, domains and hardcoded values
- [ ] Scan the git history for secrets (for example gitleaks)
- [ ] Complete `.env.schema` and `.env.example` for a third-party install

**Stretch (up to 40 h/week)**

- [ ] Security review of the login-free share surfaces (OWASP), written as a threat model
- [ ] Rate limiting on the share routes and the auth endpoints
- [ ] Dependency and license audit of the whole tree

## Phase G - Release (S22-S25, July to September)

### S22 (2027-07-19 to 2027-08-01) - Installer

- [ ] One-command setup with Docker Compose, including the database and workers
- [ ] Guide for the render node: M4 or a Linux PC
- [ ] Test on a fresh machine with no prior knowledge

**Stretch (up to 40 h/week)**

- [ ] Publish multi-arch images to a container registry
- [ ] Upgrade path: migrations run on start, a documented update procedure
- [ ] Backup and restore guide for the database and media

### S23 (2027-08-02 to 2027-08-15) - Hardware guide

- [ ] Parts list with a price range
- [ ] Mounting and mast, with photos
- [ ] Calibration guide
- [ ] Notes on GDPR, minors, and consent

**Stretch (up to 40 h/week)**

- [ ] 3D-printable dual-camera mount (CAD source and STL)
- [ ] Short video tutorial: setup on match day
- [ ] Test and document a second camera model as an alternative

### S24 (2027-08-16 to 2027-08-29) - English UI and demo

- [ ] English translation through the existing content layer
- [ ] Demo game with the consent of everyone in it, or a training session
- [ ] README, CONTRIBUTING, screenshots

**Stretch (up to 40 h/week)**

- [ ] Hosted read-only demo instance
- [ ] Documentation website built from `docs/`
- [ ] Set up community translations and seed Dutch as the third language

### S25 (2027-08-30 to 2027-09-12) - Launch at the start of the field season

- [ ] Make the repo public and tag the first release
- [ ] Announce in hockey communities and let the reco project know
- [ ] Walk at least one other club through setup

**Stretch (up to 40 h/week)**

- [ ] Onboard three clubs instead of one
- [ ] Open a community channel and publish the public roadmap
- [ ] Triage and answer the first wave of issues within a week

## S26 (2027-09-13 to 2027-09-26) - Buffer and retrospective

- [ ] Post-launch fixes
- [ ] Retrospective and a plan for year two

**Stretch (up to 40 h/week)**

- [ ] Year-two spike: live streaming prototype
- [ ] Year-two spike: automatic highlights from whistle detection (P2-2)

## Out of scope for year one

Live streaming, automatic highlights from whistle detection (P2-2), player statistics, and custom
capture hardware (Raspberry Pi or Jetson instead of GoPros). S26's stretch items only spike the
first two to scope year two.
