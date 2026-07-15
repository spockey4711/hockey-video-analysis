# hockey-video-analysis

Next.js web app for field-hockey coaches: tag moments in multi-chapter game recordings
(Tor, Ecke kurz, Aktion gut/schlecht), link them to players, and share cut clips via
login-free secret links. The Python double-whistle detector and the ffmpeg cut-worker live
in the sibling project `hockey-video-pipeline`; this repo is only the app (coach tagging +
clip sharing + enqueuing cut jobs).

Guidance for AI assistants (and humans) working in this repo. Keep it short; the detail lives
in [`docs/`](docs/). Start there before non-trivial work.

## Always

- **Commit after every small fix or task.** One logical change per commit,
  [Conventional Commits](CONTRIBUTING.md), imperative summary. Small commits beat big ones.
- **Two long-lived branches.** Feature work integrates on `develop`; `develop`
  is promoted to the always-deployable `master` via a periodic release PR. Never merge
  a feature branch straight into `master`. See
  [`docs/engineering/git-workflow.md`](docs/engineering/git-workflow.md).
- **Every code change lives in its own worktree - no exceptions.** Before touching a single
  line, create the task's branch as its own worktree with `pnpm wt new <type>/<slug>` (e.g.
  `pnpm wt new fix/scroll-jitter`), which branches off `develop`, then `cd` into the printed
  worktree path and do *all* work there. This is non-negotiable even for a one-line fix, a typo,
  or a docs tweak: if you are about to edit a file and you are not inside a per-task worktree,
  stop and create one first. Never edit or commit in the main clone, and never commit directly
  to `develop` or `master`. The main clone stays on `master` - never `git checkout` a feature
  branch in it, so parallel sessions never collide. One worktree = one branch = one task = one
  PR. Clean up merged worktrees with `pnpm wt gc`.
- **Follow the task lifecycle.** A request like "do task X from the backlog" means: fetch,
  create the worktree (off `develop`), work in small commits, run the quality gate,
  push, open a PR into `develop` (referencing the task), then hand the PR off.
- **Agents push and open PRs; only the human merges.** An AI assistant may commit, push its
  branch, and open the PR into `develop`, and that is where it stops. Never merge a PR, never
  self-approve, never push to `develop` or `master` directly - the merge is always the human's
  call.
- **Fetch before starting work.** `git fetch` at the start of a session and before creating a
  new branch, so you have the latest state from remote.
- **English** in code, comments, docs, commits. Localize user-facing copy in a dedicated content layer, never as scattered string literals.
- **No emojis, no fancy dashes** anywhere. Regular hyphen `-` only.
- **Docs + `CHANGELOG.md` change in the same PR** as the code they describe. Update only the
  docs relevant to your change.

## Before pushing

```bash
sh scripts/check-env.sh && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Engineering standards

Treat this like production code at a serious software company. The concrete rules live in the
docs below; the mindset behind them is in
[`docs/engineering/engineering-standards.md`](docs/engineering/engineering-standards.md).

- Read before you write; match the surrounding style.
- Small, reversible steps; keep the tree green at every step.
- Make it work, then right, then fast. Prefer boring, obvious solutions.
- Strict types, deliberate error handling, zero warnings in CI.
- Never trust input; never leak secrets. OWASP mindset.
- Every change goes through a PR - self-review the full diff first, then push and open the PR;
  the human does the merge.

## Stack notes (Next.js)

- `pnpm wt` is wired as a package script; use it for worktrees.
- Server Components by default; `'use client'` only at interactive leaves (the tagging player,
  hotkey capture). Never fetch live data from client components - go through `app/api/*` route
  handlers.
- Tailwind + design tokens only, no raw hex in components. No business logic in JSX; extract to
  `lib/` and test it.
- **Game time is global, never file-local.** All tagging, scrubbing, and clip math runs on a
  single game-time offset mapped to `(source file, local offset)` via `game_sources.duration_s`.
  Use the shared mapping utility - never assume a chapter boundary. See ADR 0002.
- **Secret-link surfaces are login-free and must not leak.** Team and per-player clip views are
  reached by unguessable share tokens; keep them `noindex`, no directory listing, and never
  expose one player's `single` clips on another's link.
- Persistence and auth come from the `postgres` and `auth` flavors (see `docs/flavors/`); wire
  those rather than hand-rolling schema or session handling.
- No secrets in the client bundle or `NEXT_PUBLIC_*`. Share tokens are secrets too.
- Ops artifacts ship as fillable skeletons: a multi-stage `Dockerfile` (Next.js `output:
  "standalone"` built on `node:22-slim` -> a slim non-root runtime running `node server.js`) +
  `.dockerignore` + `docker-compose.yml` for self-hosting, and `deploy/` for a hosted target
  (`vercel.json`, `render.yaml`, `fly.toml`, `terraform/`). Vercel is the primary managed target and
  needs no Dockerfile; the Dockerfile is for self-hosting the standalone output. Keep the one target
  you deploy to and delete the rest.
- The environment is a validated contract: `.env.schema` declares each variable (required/optional,
  optional `pattern=`), separating build-time `NEXT_PUBLIC_*` values from server-only secrets, and
  the quality gate (plus CI) runs `scripts/check-env.sh` to keep `.env.example` in lockstep with it
  and enforce required keys in any real `.env`. Declare new variables in both the schema and
  `.env.example`, or the gate fails.

## Where things are

- Full process: [`CONTRIBUTING.md`](CONTRIBUTING.md) ·
  [`docs/engineering/git-workflow.md`](docs/engineering/git-workflow.md)
- Code style: [`docs/engineering/conventions.md`](docs/engineering/conventions.md)
- Quality bar & tests: [`docs/engineering/quality-and-testing.md`](docs/engineering/quality-and-testing.md)
- Architecture decisions: [`docs/decisions/`](docs/decisions/) (esp. 0002 global game-time,
  0003 hardware role split, 0004 clip cutting)
- Reusable capabilities (db, auth): [`docs/flavors/`](docs/flavors/)
- What to build next: `docs/project/backlog.md`
