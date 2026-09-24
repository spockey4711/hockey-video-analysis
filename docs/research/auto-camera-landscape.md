# Open-source auto camera for field hockey: landscape and feasibility

- **Date:** 2026-09-24 (all repository numbers observed on this date)
- **Status:** Research note, no decision taken

## 1. Summary / bottom line

A Veo-style camera for field hockey (two fixed cameras, a stitched panorama, detection and
tracking, a smoothed virtual pan/zoom) does not have to be built from scratch. One project already
covers the whole capture-to-follow-cam chain, is actively developed, and ships Apple Silicon builds:
**reco-project/video-stitcher** (Rust, AGPL-3.0-only, 1132 commits, 33 releases, latest v0.5.4 on
2026-08-07) [1][2][12]. It is tuned for football (soccer) and ships a generic COCO-trained YOLO26
model, so its **ball** tracking is unproven for a 7.3 cm hockey ball. Its **player-cluster** framing
does not depend on the ball, though [7][9]. The other serious DIY system, HockeyMONStream /
HockeyMON, is built for ice hockey, needs NVIDIA hardware (DeepStream/CUDA), and has licensing
problems for reuse [15][16][19]. No open field-hockey tracking dataset of useful size and quality
turned up. The one public ball dataset could not be inspected [25], and the one peer-reviewed
field-hockey tracking paper is about players, runs at 3 fps, and has no code [26]. The
back-of-envelope in section 7 shows why the ball is the hard part: from a 6 m mast at the sideline,
two 4K cameras give the ball about **2-5 px** across the far half of the pitch. **Recommendation:**
do not start a new project. Run a one-day feasibility experiment with reco's macOS CLI on the M4
using real field-hockey footage (section 10). If player-cluster framing is good enough, integrate it
as a batch job whose output becomes the game's source video. Consider a ball-specific model later.

## 2. Question and scope

How feasible is an open-source, community-published, Veo-style automatic camera for outdoor field
hockey (91.40 x 55.00 m pitch [33], ball 224-235 mm circumference, i.e. 71.3-74.8 mm diameter
[33]), and which existing projects can be reused? In scope: open repositories (license, platform,
maturity, source-level behaviour), field-hockey datasets and papers, a hardware estimate, and fit
with this app. Out of scope: running any of the software (nothing was installed or executed), legal
advice, and a full commercial market survey.

## 3. How a Veo-style system works

1. **Capture:** two wide-angle cameras side by side on a 5-8 m mast at midfield. Veo sells 5.2 m
   (17.1 ft) and 7.4 m (24.3 ft) tripods for its dual-4K-lens Cam 3 [36].
2. **Sync and calibration:** align the two streams in time (audio cross-correlation or timecode),
   then correct lens distortion and estimate the relative pose once per rig setup.
3. **Stitching:** project both views onto one cylindrical/spherical panorama (~180 deg) every frame.
4. **Detection and tracking:** detect players and the ball per frame (often every N frames), mask
   out-of-field detections with a field polygon, and track across frames.
5. **Virtual camera ("director"):** turn tracks into a pan/zoom target (ball, player cluster, or a
   blend), then smooth it (EMA, One Euro, PID, Kalman) so it looks like a human operator.
6. **Render and platform:** crop/reproject the panorama into a 1080p follow-cam video, then do
   highlights, tagging, and sharing. That last layer is what this app already is.

## 4. Landscape

| Project                                        | Covers                                                                        | License (SPDX, from files)                                                                                                           | GPU / platform                                                                 | Apple Silicon                                                                              | Maturity (2026-09-24)                                                                  | Sports tested                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| reco-project/video-stitcher (upstream) [1]     | stitch, sync, detect, track, virtual cam, GUI/CLI/OBS                         | `AGPL-3.0-only` [2][3], CLA grants maintainer relicensing rights [5]                                                                 | wgpu (Vulkan/Metal/DX12); ORT CPU/CUDA/CoreML, NCNN, TensorRT [3]              | **Yes, builds published** (`reco-cli`/`reco-gui` `macos-arm64` assets) [12]; not run by us | 47 stars, 14 forks, 1132 commits, last commit 2026-08-06, 33 releases [1][12]          | Football (soccer); defaults "tuned for football (soccer) at 30fps" [7]; forum mentions arena soccer, basketball [14] |
| cjolivier01/HockeyMONStream [15]               | stitch, detect, track, virtual cam, streaming, scoreboard                     | Mixed: root `LICENSE.md` is MIT (DeepStream-Yolo copyright), plus Apache-2.0 files and `LicenseRef-NvidiaProprietary` files [16][17] | NVIDIA DeepStream, CUDA, TensorRT; Ubuntu x86_64, Jetson, Windows via WSL [15] | **No** (NVIDIA-only)                                                                       | 0 stars, 492 commits, last commit 2026-09-24, latest release v0.1.8 on 2026-09-18 [18] | Ice hockey ("adaptable" to field sports is a claim) [15]                                                             |
| cjolivier01/HockeyMON [19]                     | stitch (Hugin), track, virtual cam (Python)                                   | **None granted**: `LICENSE` file is 0 bytes, GitHub reports NOASSERTION [19]                                                         | CUDA streams, Hugin/enblend built from source [19]                             | Unclear, CUDA-oriented                                                                     | 1 star, 1074 commits, last commit 2026-09-24 [19]                                      | Ice hockey [19]                                                                                                      |
| chele-s/AutoCam-AI [20]                        | detect (RF-DETR), ball EKF, virtual cam (One Euro + PID); **no stitching**    | `MIT` [20]                                                                                                                           | NVIDIA CUDA 11.8+, NVDEC/NVENC, 12 GB VRAM for 4K [20]                         | **No** (README requires NVIDIA)                                                            | 6 stars, 258 commits, last commit 2025-12-11, 0 releases [20]                          | Football (soccer) [20]                                                                                               |
| roboflow/sports [21]                           | detection, pitch keypoints, team clustering (toolkit + demos); no virtual cam | `MIT` [21]; soccer example depends on `ultralytics` (AGPL-3.0) [21][23]                                                              | Python, PyTorch                                                                | Likely (pure Python); not verified                                                         | 5383 stars, 34 commits, last commit 2025-05-27, 1 release [21]                         | Soccer, basketball [21]                                                                                              |
| cemunds/awesome-sports-camera-calibration [22] | reading list (homography, field registration)                                 | `CC0-1.0` [22]                                                                                                                       | n/a                                                                            | n/a                                                                                        | 140 stars, 13 commits, last commit 2021-02-14 [22]                                     | Mostly soccer; one broadcast-hockey rectification paper [22]                                                         |
| nttcom/WASB-SBDT [28]                          | small-ball detection + tracking baseline (research)                           | `MIT` [28]                                                                                                                           | PyTorch                                                                        | Unclear                                                                                    | 193 stars, 6 commits, last commit 2023-11-23 [28]                                      | Five ball-sport datasets (BMVC 2023); no field hockey found [28]                                                     |

Forks of reco: the upstream is `reco-project/video-stitcher` (GitHub `fork: false`). 14 forks were
listed on the observation date [13]. `cjolivier01/video-stitcher` (fork, 1479 commits, C++ as main
language, last commit 2026-09-14), `wendibus/video-stitcher-with-scoreboard` (fork, one release
`v0.5.4-macos-dmg-poc`), and `RufanMelfor/video-stitcher` (fork) all carry AGPL-3.0 [13].
`JhnsonO/video-stitcher` is a detached copy (`fork: false`, 1160 commits, AGPL-3.0). None of them
has stars or its own documentation. Treat them as personal branches, not alternatives.

## 5. Per-project notes

**reco-project/video-stitcher.** Verified in source, not just the README:

- **Inputs:** two video files. The `InputPath::Chained(Vec<PathBuf>)` type models "multiple
  segments that form one continuous recording (e.g. DJI 4GB splits)" [10], and the GUI asks for
  "left camera file(s)" [4]. GoPro chapter ordering was not verified specifically.
- **Sync:** `reco-calibrate/src/audio_sync.rs` does FFT audio cross-correlation between the two
  cameras [11]. There is also a manual sync-offset slider [4].
- **Lens and stitch:** lens profiles are converted from Gyroflow's CC0 database, and features use
  AKAZE [3]. The shaders include cylindrical and fisheye projection. Calibration test data exists
  for GoPro 10 4K [1].
- **Detection:** YOLO via ONNX Runtime (CPU/CUDA/CoreML), NCNN, or TensorRT [3]. There is a
  `coreml_inference.rs` [1]. The release ships `yolo26n.onnx` (1280 input) and `yolo26n_640.onnx`
  [4][12]. The ball class is resolved from the model's labels as `"ball"` or `"sports ball"` and
  falls back to COCO id 32 [9]. So a **custom model with a `ball` class plugs in without code
  changes**, but the stock model is generic COCO. YOLO26 weights are Ultralytics models under
  AGPL-3.0 (or an Ultralytics enterprise license) [23].
- **Tracking and virtual camera:** `BallTracker` filters by class, requires the ball to be near a
  player ("player anchor"), picks the candidate nearest the last position within a max jump, and
  "coasts" for N frames before it reports the ball lost [8]. `FieldPanner` has an Action mode
  (densest player cluster, EMA, edge-push, optional ball blend) and a FrameAll mode (all players
  in frame). It adds lookahead, velocity-clamped chase, a soft dead zone, and dynamic FOV [7]. A
  `SmoothedDirector` applies One Euro filtering, and a polygon ROI filter drops off-field
  detections [6]. Detection runs every N frames. The quickstart suggests 10-15 for football [4].
- **Interfaces:** CLI (`reco stitch left.mp4 right.mp4 -c cal.json --model ... --tracking field`),
  a Slint GUI, and an OBS plugin [3][4]. A debug script renders detections, ROI and panner
  decisions side by side [4].
- **Project health:** one maintainer holds a CLA that allows future dual licensing [5]. The
  community forum is active and discusses GoPro 11/12 mixing, calibration failures, macOS setup,
  and a "Reco Kit camera" [14]. The website pitches it as an "open-source AI camera that films the
  whole football match" [14].

**HockeyMONStream / HockeyMON.** These are the closest in intent: a DIY Pixellot/Hudl/Veo
alternative, with GoPro and Insta360 chapter layouts under `cam1/`, `cam2/` [15]. But there are
three blockers for us:

- **Hardware:** NVIDIA DeepStream/CUDA only, with no macOS target [15].
- **Licensing:** `LICENSING.md` says explicitly that the root MIT file does not cover every file.
  NVIDIA-derived files are `LicenseRef-NvidiaProprietary` and "an express NVIDIA license may be
  required" [16]. The Python HockeyMON repo grants no license at all (empty `LICENSE`) [19].
- **Sport:** ice hockey (rink masking, puck). The default detector is COCO YOLOX-s [15].

It is useful as a design reference only, for example its chapter discovery and its archive remux
without re-encode [15].

**AutoCam-AI.** A single-camera ball follower for football. It uses RF-DETR (Apache-2.0 upstream
[24]), a 6-state EKF with Mahalanobis gating, and One Euro + PID smoothing [20]. It has no
stitching and needs an NVIDIA GPU. It is worth reading as a reference for ball-first smoothing, not
as a base.

**roboflow/sports.** A toolkit and demo repo (soccer player/ball/pitch-keypoint models, team
clustering). It names ball tracking "extremely difficult due to its small size and rapid movements"
[21]. MIT itself, but its examples pull in AGPL `ultralytics` [21][23]. Useful for team clustering
and field keypoints if we ever do analytics, not for the auto camera.

**Academic references (key only).** Chen and Carr's survey of autonomous camera systems (AAAI
workshop 2014) [29]. Chen, Le, Carr, Yue, Little, "Learning Online Smooth Predictors for Realtime
Camera Planning using Recurrent Decision Trees" (CVPR 2016), which learns where the camera should
look from human operators' pan angles given noisy player detections [30]. CineFilter, real-time
trajectory smoothing at 250-1000 fps [31]. Sports field registration (TVCalib, PnLCalib, both on
SoccerNet-Calibration) [32]. Takeaway: player-distribution-based framing plus heavy smoothing is
the well-trodden path, and ball-only framing is the fragile part.

**"OpenDarts"-style publication.** No single canonical project exists. Two candidates:
`OpenDartboard/OpenDartboard`, "a hobby-friendly, fully FOSS toolkit" for automatic steel-tip
scoring with a Raspberry Pi Zero 2 W and three cameras (GPL-3.0, 20 stars, v0.1.4, last commit
2025-07-31). And `dmall00/OpenDarts`, a self-hostable darts app with phone auto-scoring
(TypeScript, no detected license, 4 stars) [42]. Which one the user meant is **unclear**. The
pattern either way is cheap commodity cameras, open build instructions, open software.

## 6. Field hockey specifics

- **Ball size:** 71.3-74.8 mm diameter [33] vs a football's 68-70 cm circumference, about 22 cm
  diameter [34]. That is roughly **one third the diameter and one ninth the image area** at the
  same distance. The ball is white (or a contrasting colour) on a usually blue or green turf [33].
- **Ball speed:** elite drag flicks are reported at roughly 18-25 m/s (**unverified**: the numbers
  come from a search snippet of a 2016 Sports Biomechanics paper, and the full text was not
  accessible [35]). Hits and flicks leave the ground, and much play is at stick level among legs,
  so occlusion is frequent.
- **Datasets:**
  - Roboflow Universe `new-workspace-feryy/hockey-8qcvv` is described as 2689 `hockey_ball` images,
    CC BY 4.0, published September 2024 [25]. **Unverified:** the page returned HTTP 403 to every
    fetch, so image count, license, and camera perspective (broadcast vs elevated wide) could not
    be checked.
  - No field-hockey dataset was found in the SBDT/WASB benchmark [28], and none on arXiv. Ice
    hockey has several (HockeyAI, HockeyRink), but those are puck/rink domains.
- **Papers:**
  - Moura, Kholkine, Van Damme, Mets, Leysen, De Schepper, Hellinckx, Latre, "Low Cost Player
    Tracking in Field Hockey", MLSA 2021, Springer CCIS vol. 1571, pp. 103-115 (2022),
    doi:10.1007/978-3-031-02044-5_9 [26]. Single low-cost stationary camera, player tracking only,
    "full pipeline at 3 fps on a computer with a simple graphics card". No code link found.
  - Patel and Kamdar, "Accurate ball detection in field hockey videos using YOLOV8", IJARIIT 9(2),
    2023 [27]. A low-tier journal with no public dataset. It does not change the picture.
- **Untested:** no open project documents any field-hockey run. Not verified by anyone: reco's
  football defaults for panner speed, cluster bandwidth, and max ball jump on a 91 x 55 m hockey
  pitch; ball detection on turf; framing of penalty corners (tight cluster at the circle edge).
  Veo, Pixellot, and Spiideo all market field hockey [37][38][39], and Trace says its AI "isn't
  optimized for ... field hockey" [40]. XbotGo does not list field hockey [41]. So the commercial
  players treat it as supported but secondary.

## 7. Hardware considerations

**Pixels per ball (back-of-envelope).** Assumptions:

- Rig at the halfway line, 5 m behind the near sideline, lens 6 m high.
- Two 4K cameras (3840 px wide), each covering ~100 deg horizontal after undistortion, overlapping
  ~20 deg to span ~180 deg. That gives about **38 px/deg** and a panorama about 6900 px wide.
- Ball 73 mm. Angular size = 0.073 m / slant distance.
- Motion blur and compression ignored.

| Ball position           | Slant distance | Ball size | Pixels across |
| ----------------------- | -------------- | --------- | ------------- |
| Near sideline, midfield | 7.8 m          | 0.54 deg  | ~21 px        |
| Near corner (goal line) | 46 m           | 0.090 deg | ~3.5 px       |
| Pitch centre            | 33 m           | 0.127 deg | ~4.9 px       |
| Far sideline, midfield  | 60 m           | 0.069 deg | ~2.7 px       |
| Far corner              | 76 m           | 0.055 deg | ~2.1 px       |

A football at the far corner would be ~6.4 px. Over most of the pitch the hockey ball is 2-5 px.
That is far below the usual "small object" regime for detectors (COCO's small is < 32 x 32 px,
convention quoted from memory, **unverified** here). Temporal information and a hockey-specific
model would be needed. At 25 m/s the ball moves 0.83 m (about 11 diameters) between frames at
30 fps. A 1/250 s shutter still smears it over ~1.4 diameters, and auto-exposure on overcast days
will be slower. Implications:

- Ball-first framing needs 50/60 fps, a fast shutter, a higher mast (more pixels on the far half,
  less occlusion), and a fine-tuned model. Player-cluster framing (reco's Action mode [7]) degrades
  much more gracefully, because players are ~1.7 m tall and 30-50 px even at the far corner.
- Height: 6-8 m is the commercial norm [36]. Every metre helps depth separation on the far half.
- Lenses: fisheye/HyperView-style lenses spread pixels evenly across angle but need a good lens
  profile. reco ships Gyroflow profiles and a GoPro 10 calibration fixture [1][3].
- Baseline: mount the two cameras as close together as possible and rotated about a common point
  to minimise stitching parallax (general stitching practice, not project-verified).

**Sync.** Audio cross-correlation (reco [11]) handles the start offset. Clock drift between two
consumer cameras over 70+ minutes is not handled explicitly in the code read (**unverified**). A
sharp sound at the end of the game (whistle, clap) gives a cheap drift check.

**Storage per game.** One GoPro today produces 4-8 chapters of ~4 GB per game (ADR 0008 [43]).
Two cameras double that to **~32-64 GB of originals per game**, plus the rendered follow-cam
(1080p, a few GB). On Google Drive that doubles upload time too. Upload is already "hours on a
home connection" for one camera [43].

## 8. Fit with this app

**What reuse looks like.** The app stays the platform, and stitching plus auto-follow becomes an
M4 batch job, which is exactly the ADR 0003 split: heavy compute on the M4, never on the VPS [43].

1. The coach drops `left/` and `right/` chapter folders for a game.
2. On the M4, `reco stitch left/*.MP4 right/*.MP4 -c rig.json --model yolo26n.onnx --tracking
field` renders one follow-cam MP4 per game (plus optionally the full panorama for re-framing).
3. That follow-cam file is uploaded to Drive and ingested as the game's source (ADR 0008 [43]).
   Tags, clips, whistle detection, and sharing work unchanged.

Global game time (ADR 0002 [43]) still holds: the stitched output is one continuous timeline, so
the game gets one `game_sources` row (or a few, if the renderer splits files). The follow-cam
render must count as the "original" for copy-cuts (ADR 0004). Clips then show the virtual camera,
not the static panorama. The two per-camera chapter sets become archive material the app never
reads. A worse alternative keeps the panorama as the source and does the crop at clip time. That
needs re-encoding on the VPS and violates ADR 0003.

**License compatibility.** This repo has **no LICENSE file**, and `package.json` has
`"private": true` with no `license` field [43], so it is currently all-rights-reserved. Running
reco as a separate executable that reads video files and writes a video file keeps the two
programs separate. The AGPL obligations then attach to reco (offer its source, and our
modifications if we patch it) and not to this app, and the output video is not a derivative of the
program. This is the common reading, **not legal advice**. Linking reco crates into our code, or
serving a modified reco over a network, would pull AGPL obligations in. YOLO26 weights are AGPL
too [23], which matters only if we redistribute them. A fine-tuned ball model is better trained
from an Apache-2.0 base such as RF-DETR [24] if we want to publish it permissively.

**What changes if this app is open-sourced as a community project.**

- **License:** pick one (MIT/Apache-2.0 if reco stays a separate process, AGPL-3.0 if we want to
  align with reco and keep hosted forks open). Add `LICENSE`, drop `"private": true`.
- **Multi-team:** the team share link is a single `TEAM_SHARE_TOKEN` env var and the schema
  assumes one team [43]. A community release needs teams/clubs as rows with
  their own tokens.
- **Storage abstraction:** ADR 0008 hard-wires Google Drive via an rclone mount with a service
  account [43]. A community release needs a storage interface (local disk, S3-compatible, Drive).
- **Installer:** Docker Compose and a Dockerfile already exist [43]. Missing: a documented
  one-command setup, and a documented M4/desktop "render node" that pulls jobs (the clip worker
  pattern, ADR 0007 [43]).
- **Hardware guide:** a parts list (two action cams, mast, mount), rig calibration steps, and a
  sample game. This is the "OpenDartboard" part of the publication.

## 9. Open questions and risks

- **Ball detection on turf at 2-5 px** is the core technical risk. It is unknown whether any model
  gets usable recall on the far half. There is also no public field-hockey dataset we could verify.
- **reco's football defaults** may pan too slowly or too eagerly on hockey (faster ball, smaller
  pitch, set pieces at the circle). Tuning via `FieldPannerConfig` is possible [7] but untested.
- **Bus factor and licensing drift:** reco is effectively one maintainer with a CLA that enables
  dual licensing [5]. Future versions could go commercial. The AGPL releases we pin stay AGPL.
- **macOS path maturity:** macOS arm64 builds exist [12], but the CoreML/VideoToolbox path
  throughput on an M4 is unmeasured. A 70-minute game at 4K x2 may take longer than real time.
- **Two-camera logistics:** sync drift, mast safety and wind, club permission, double upload time.
- **Commercial comparison:** Veo, Pixellot, and Spiideo already sell this for field hockey with
  subscriptions [36][37][38][39]. The open version's value is cost and data ownership, not quality.
- **Unverified items** are marked inline. The main ones are the Roboflow dataset details, drag-flick
  speeds, the COCO small-object threshold, and clock drift handling.

## 10. Recommended next step

A one-day feasibility spike, no code in this repo:

1. Film one training session or game with two GoPros (the existing one plus a borrowed one) on the
   highest safe mount available (stand, balcony, or telescopic pole, target 5-6 m) at midfield.
   Use 4K, 50/60 fps, the same lens mode on both, and a clap at start and end.
2. On the M4, download `reco-cli` v0.5.4 `macos-arm64` and `yolo26n.onnx` [12]. Calibrate
   (auto-calibrate plus lens profile), draw the field ROI, and render a 10-minute segment with
   `--tracking field --detection-interval 10 --events detections.jsonl` [4].
3. Measure four things and write them into a short follow-up note:
   - Calibration success and stitch seam quality.
   - Render speed on the M4 (x real time).
   - Ball recall per pitch third: annotate ~100 frames by hand using `visualize_detections.py` [4].
   - A subjective 1-5 rating of Action vs FrameAll framing, covering open play, a penalty corner,
     and a long ball.
4. Decide:
   - **Go:** if player-cluster framing is watchable, write an ADR for "follow-cam render as game
     source" and a backlog task for the M4 render job.
   - **Ball is the gap:** if only the ball fails, scope a fine-tuned `ball` model (drop-in via the
     label lookup [9]) as a separate task.
   - **No-go:** if stitching or speed fails on macOS, stop. The fallback is a single wide camera,
     which the forum says reco supports (**unverified**) [14].

## 11. Sources

All repository metadata (stars, forks, commits, dates, releases, detected license) was read from
the GitHub REST API on 2026-09-24. File contents were read from `raw.githubusercontent.com` at the
default branch on the same date.

1. reco-project/video-stitcher, repository and file tree. https://github.com/reco-project/video-stitcher
2. reco-project/video-stitcher `LICENSE` (GNU AGPL v3 text). https://github.com/reco-project/video-stitcher/blob/main/LICENSE
3. reco-project/video-stitcher `README.md` ("AGPL-3.0-only", platforms, backends, Gyroflow/AKAZE notes in `THIRD_PARTY_NOTICES.md`). https://github.com/reco-project/video-stitcher/blob/main/README.md
4. reco-project/video-stitcher `QUICKSTART.md`. https://github.com/reco-project/video-stitcher/blob/main/QUICKSTART.md
5. reco-project/video-stitcher `CONTRIBUTING.md` (Contributor License Agreement, dual licensing). https://github.com/reco-project/video-stitcher/blob/main/CONTRIBUTING.md
6. reco-project/video-stitcher `crates/reco-autocam/README.md`. https://github.com/reco-project/video-stitcher/blob/main/crates/reco-autocam/README.md
7. reco-project/video-stitcher `crates/reco-autocam/src/panners/field.rs`. https://github.com/reco-project/video-stitcher/blob/main/crates/reco-autocam/src/panners/field.rs
8. reco-project/video-stitcher `crates/reco-autocam/src/trackers/ball.rs`. https://github.com/reco-project/video-stitcher/blob/main/crates/reco-autocam/src/trackers/ball.rs
9. reco-project/video-stitcher `crates/reco-autocam/src/lib.rs` (class-id resolution, COCO fallback). https://github.com/reco-project/video-stitcher/blob/main/crates/reco-autocam/src/lib.rs
10. reco-project/video-stitcher `crates/reco-io/src/stitch_job.rs` (`InputPath::Chained`). https://github.com/reco-project/video-stitcher/blob/main/crates/reco-io/src/stitch_job.rs
11. reco-project/video-stitcher `crates/reco-calibrate/src/audio_sync.rs`. https://github.com/reco-project/video-stitcher/blob/main/crates/reco-calibrate/src/audio_sync.rs
12. reco-project/video-stitcher releases (v0.5.4 assets incl. `macos-arm64`, `yolo26n.onnx`). https://github.com/reco-project/video-stitcher/releases
13. Forks and copies: https://github.com/reco-project/video-stitcher/forks, https://github.com/cjolivier01/video-stitcher, https://github.com/wendibus/video-stitcher-with-scoreboard, https://github.com/RufanMelfor/video-stitcher, https://github.com/JhnsonO/video-stitcher
14. Reco website and community forum (redirect to reco.cam). https://reco.cam/, https://forum.reco.cam/
15. cjolivier01/HockeyMONStream `README.md`. https://github.com/cjolivier01/HockeyMONStream
16. cjolivier01/HockeyMONStream `LICENSING.md`. https://github.com/cjolivier01/HockeyMONStream/blob/master/LICENSING.md
17. cjolivier01/HockeyMONStream `LICENSE.md` (MIT, copyright Marcos Luciano Piropo Santos and NVIDIA). https://github.com/cjolivier01/HockeyMONStream/blob/master/LICENSE.md
18. cjolivier01/HockeyMONStream releases (v0.1.8, 2026-09-18). https://github.com/cjolivier01/HockeyMONStream/releases
19. cjolivier01/HockeyMON `README.md` and root listing (`LICENSE` 0 bytes). https://github.com/cjolivier01/HockeyMON
20. chele-s/AutoCam-AI `README.md` and `LICENSE` (MIT). https://github.com/chele-s/AutoCam-AI
21. roboflow/sports `README.md`, `LICENSE` (MIT), `examples/soccer/requirements.txt`. https://github.com/roboflow/sports
22. cemunds/awesome-sports-camera-calibration (CC0-1.0). https://github.com/cemunds/awesome-sports-camera-calibration
23. Ultralytics licensing and YOLO26 docs (AGPL-3.0 or Enterprise); ultralytics/ultralytics repo license AGPL-3.0. https://www.ultralytics.com/license, https://docs.ultralytics.com/models/yolo26
24. roboflow/rf-detr repository (Apache-2.0 per GitHub license detection). https://github.com/roboflow/rf-detr
25. Roboflow Universe, "hockey" by new-workspace-feryy. https://universe.roboflow.com/new-workspace-feryy/hockey-8qcvv (HTTP 403 on fetch; figures from search-result snippet, **unverified**)
26. Moura et al., "Low Cost Player Tracking in Field Hockey", MLSA 2021, CCIS 1571, Springer 2022, pp. 103-115, doi:10.1007/978-3-031-02044-5_9. Record: https://www.sponet.de/Record/4078048
27. S. H. Patel, D. Kamdar, "Accurate ball detection in field hockey videos using YOLOV8", IJARIIT 9(2), 2023. https://www.ijariit.com/manuscripts/v9i2/V9I2-1305.pdf
28. Tarashima et al., "Widely Applicable Strong Baseline for Sports Ball Detection and Tracking", BMVC 2023, arXiv:2311.05237; code https://github.com/nttcom/WASB-SBDT (MIT)
29. J. Chen, P. Carr, "Autonomous Camera Systems: A Survey", AAAI-14 Workshops. https://cdn.aaai.org/ocs/ws/ws1166/8733-38047-1-PB.pdf
30. J. Chen, H. M. Le, P. Carr, Y. Yue, J. J. Little, "Learning Online Smooth Predictors for Realtime Camera Planning using Recurrent Decision Trees", CVPR 2016. https://openaccess.thecvf.com/content_cvpr_2016/html/Chen_Learning_Online_Smooth_CVPR_2016_paper.html
31. Achary et al., "CineFilter: Unsupervised Filtering for Real Time Autonomous Camera Systems", arXiv:1912.05636
32. TVCalib, arXiv:2207.11709; PnLCalib, arXiv:2404.08401 (SoccerNet-Calibration)
33. FIH, Rules of Hockey, effective 1 March 2026 (pitch 91.40 x 55.00 m; ball circumference 224-235 mm; white or contrasting colour). https://www.fih.hockey/static-assets/pdf/fih-Rules-of-hockey-2026-final.pdf
34. IFAB, Laws of the Game, Law 2 - The Ball (circumference 68-70 cm). https://www.theifab.com/laws/latest/the-ball/
35. "Kinematic analysis of the drag flick in field hockey", Sports Biomechanics, 2016, doi:10.1080/14763141.2016.1182207 (full text not accessible; velocities from search snippet, **unverified**)
36. Veo Cam 3 product page (dual 4K lenses, 1080p follow-cam, tripods 17.1 ft / 24.3 ft, subscription). https://www.veo.com/en-us/product/veo-cam-3
37. Veo field hockey page. https://www.veo.com/us/field-hockey-camera/
38. Pixellot field hockey page. https://www.pixellot.tv/sports/field-hockey/
39. Spiideo field hockey page. https://www.spiideo.com/sports/field-hockey-video-analysis-software/
40. Trace Help Center, "How to record more sports". https://support.traceup.com/content/how-to-record-more-sports
41. XbotGo, "What sports does XbotGo support". https://xbotgo.com/pages/what-sports-does-xbotgo-support
42. OpenDartboard/OpenDartboard (GPL-3.0) https://github.com/OpenDartboard/OpenDartboard; dmall00/OpenDarts https://github.com/dmall00/OpenDarts
43. This repo: `CLAUDE.md` (single-team share token, Docker skeletons), `docs/decisions/0002`, `0003`, `0004`, `0007`, `0008`; `package.json` (`"private": true`, no `license`); no `LICENSE` file at the root (checked 2026-09-24).
