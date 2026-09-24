# Roadmap: open-source auto camera for field hockey

- **Created:** 2026-09-24
- **Horizon:** 12 months, 2026-09-28 to 2027-09-26
- **Capacity:** one developer, ~10 h/week -> 26 two-week sprints of ~20 h (~520 h total, ~400 h
  planned, the rest is buffer)
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
- This file is the long view. When a sprint starts, promote its items to numbered tasks in
  [`backlog.md`](backlog.md), which stays the source of truth for what is being built. Items that
  already exist there (P2-9, P2-17, P2-18, P2-19) are referenced by id.
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

### S2 (2026-10-12 to 2026-10-25) - Measure and decide

- [ ] Render 10 minutes with `--tracking field` and measure speed (x real time)
- [ ] Rate the stitch seam (ghosting, misalignment)
- [ ] Annotate 100 frames by hand and compute ball recall per pitch third
- [ ] Rate Action vs FrameAll framing 1-5 for open play, a penalty corner and a long ball
- [ ] Write the results as a follow-up note in `docs/research/`, as a PR
- [ ] **Go/no-go decision** (gate S2)
- [ ] Footage bank: film every game until the season break with both cameras, target at least 4

## Phase B - Finish the ingest path (S3-S5, November to early December)

The follow-cam render will enter the app through this path, and it is needed anyway.

### S3 (2026-10-26 to 2026-11-08) - P2-17 Drive import, part 1

- [ ] Collect P2-17's prerequisites: service account, Drive root name and folder layout, rclone
      setup by agent or by hand
- [ ] Refine P2-17 and fix its owned paths
- [ ] Detect new game folders on Drive
- [ ] Sort chapters and create `game_sources` rows, with tests
- [ ] Trigger the proxy encode on the VPS

### S4 (2026-11-09 to 2026-11-22) - P2-17 part 2 and P2-18

- [ ] Handle failure cases: half-finished uploads, duplicate imports
- [ ] End-to-end test with a real game
- [ ] P2-18: review list for newly imported games (title, date, opponent)
- [ ] Update the docs and the coach guide

### S5 (2026-11-23 to 2026-12-06) - Close P2-9 and P2-19

- [ ] P2-9: close its remaining steps (completed by P2-17)
- [ ] P2-19: fix the pen and fullscreen buttons in a narrow window
- [ ] Walk the whole flow with a footage-bank game: recording to shared link

## Phase C - Render job on the M4 (S6-S9, December to January)

### S6 (2026-12-07 to 2026-12-20) - Architecture

- [ ] ADR 0009: "The follow-cam render is the game's source" (touches ADRs 0002, 0003, 0004, 0008)
- [ ] Decide where the render job lives: `hockey-video-pipeline` (recommended) or this repo
- [ ] Define the folder convention: `left/`, `right/`, `rig.json`
- [ ] Check the data model: how does the app know a game is a follow-cam game?

### S7 (2026-12-21 to 2027-01-03) - Buffer (holidays)

- [ ] Finish open items from S6

### S8 (2027-01-04 to 2027-01-17) - Render job, part 1

- [ ] Wrapper around `reco-cli`: pin the version, check the install
- [ ] Store and reuse the calibration per rig
- [ ] Read both chapter sets, write one MP4
- [ ] Tests with a short sample clip

### S9 (2027-01-18 to 2027-01-31) - Render job, part 2

- [ ] Check clock drift against the start and end claps, warn above a threshold
- [ ] Drop the output into the Drive import folder so it flows in through phase B
- [ ] Progress and error log
- [ ] Render every game in the footage bank

## Phase D - Hockey tuning and ball model (S10-S14, February to early April)

### S10 (2027-02-01 to 2027-02-14) - Evaluation set

- [ ] Pick a labelling tool (CVAT or Label Studio)
- [ ] Label ~500 frames from 3 games: the ball, and where the camera should have looked
- [ ] Evaluation script: ball recall and framing error as one score

### S11 (2027-02-15 to 2027-02-28) - Tune the framing

- [ ] Sweep `FieldPannerConfig` systematically against the evaluation set
- [ ] Hockey presets: open play, penalty corner, play around the circle
- [ ] Measure before and after, record it in a research note

### S12 (2027-03-01 to 2027-03-14) - Ball model, data

- [ ] Label ~2,000 more ball frames from the footage bank, hard frames first
- [ ] Check the Roboflow dataset (license, perspective) for mixing in
- [ ] Split train and test by game, not by frame

### S13 (2027-03-15 to 2027-03-28) - Ball model, training

- [ ] Pick an Apache-licensed base model (for example RF-DETR)
- [ ] Fine-tune on the M4 and export to ONNX
- [ ] Plug it into reco as a custom model with the `ball` label
- [ ] Compare against the default model on the evaluation set

### S14 (2027-03-29 to 2027-04-11) - Integrate or drop

- [ ] If better: add the model to the render job, versioned (gate S14)
- [ ] If not: record the result and stay with player-cluster framing
- [ ] Update the recording checklist for the new field season

## Phase E - Field-season pilot (S15-S17, April to May)

### S15-S17 (2027-04-12 to 2027-05-23) - Pilot with our own team

- [ ] Run every game through the normal flow: record, render, import, tag, share
- [ ] Log per game what got in the way: setup time, errors, render time, coach feedback
- [ ] File the top three problems as backlog tasks and fix them
- [ ] Check the mast for wind and safety, update the guide
- [ ] Collect feedback from players and parents on the shared links

## Phase F - Ready the app for other teams (S18-S21, May to July)

### S18 (2027-05-24 to 2027-06-06) - Ground rules

- [ ] ADR: license (recommendation: AGPL-3.0)
- [ ] ADR: multi-team install or one install per club (gate S18)
- [ ] Add `LICENSE`, drop `"private": true` from `package.json`

### S19 (2027-06-07 to 2027-06-20) - Multiple teams (small if "one install per club")

- [ ] Schema migration: `teams` table with its own share token
- [ ] Move `TEAM_SHARE_TOKEN` from the env into the database
- [ ] Scope coach access to their own team, with tests
- [ ] Verify share links still never expose another team's or player's clips

### S20 (2027-06-21 to 2027-07-04) - Pluggable storage

- [ ] Define a storage interface
- [ ] Implementations for local disk and S3-compatible storage
- [ ] Put Drive behind the same interface
- [ ] Amend ADR 0008

### S21 (2027-07-05 to 2027-07-18) - Clean-up

- [ ] Remove personal paths, domains and hardcoded values
- [ ] Scan the git history for secrets (for example gitleaks)
- [ ] Complete `.env.schema` and `.env.example` for a third-party install

## Phase G - Release (S22-S25, July to September)

### S22 (2027-07-19 to 2027-08-01) - Installer

- [ ] One-command setup with Docker Compose, including the database and workers
- [ ] Guide for the render node: M4 or a Linux PC
- [ ] Test on a fresh machine with no prior knowledge

### S23 (2027-08-02 to 2027-08-15) - Hardware guide

- [ ] Parts list with a price range
- [ ] Mounting and mast, with photos
- [ ] Calibration guide
- [ ] Notes on GDPR, minors, and consent

### S24 (2027-08-16 to 2027-08-29) - English UI and demo

- [ ] English translation through the existing content layer
- [ ] Demo game with the consent of everyone in it, or a training session
- [ ] README, CONTRIBUTING, screenshots

### S25 (2027-08-30 to 2027-09-12) - Launch at the start of the field season

- [ ] Make the repo public and tag the first release
- [ ] Announce in hockey communities and let the reco project know
- [ ] Walk at least one other club through setup

## S26 (2027-09-13 to 2027-09-26) - Buffer and retrospective

- [ ] Post-launch fixes
- [ ] Retrospective and a plan for year two

## Out of scope for year one

Live streaming, automatic highlights from whistle detection (P2-2), player statistics, and custom
capture hardware (Raspberry Pi or Jetson instead of GoPros).
