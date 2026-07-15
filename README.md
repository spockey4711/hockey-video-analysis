# hockey-video-analysis

Web app for field-hockey coaches to tag game footage and share clips with players and the team.
A coach loads a game (recorded on a GoPro as several chapter files), marks moments live with
hotkeys - goals, corners, good and bad actions - links them to players, and turns the confirmed
tags into short clips that players watch through a login-free secret link.

This repository is the **web app**: coach tagging plus clip sharing. The heavy lifting - the
Python double-whistle detector and the `ffmpeg` cut-worker - lives in the sibling project
`hockey-video-pipeline`. The two communicate through shared state (a job queue in Postgres) and
shared storage (the NAS), not through in-process calls.

## Why it exists

- A GoPro splits a long recording at ~4 GB into several files. One game is therefore N files that
  together form a single continuous timeline.
- Every part of the system - player, cut-worker, whistle detector - must agree on _when_ an event
  happened. We use one time coordinate everywhere: the **global game-time offset** (seconds since
  the start of the game), and convert to `(source file, local offset)` only at the edges. See
  [ADR 0002](docs/decisions/0002-global-game-time-offset-model.md).
- Work is split across three machines by cost profile - an always-on VPS coordinates and only
  cuts without re-encoding, the MacBook M4 runs heavy batch jobs (audio analysis, optional
  re-encoding, later ML), and the NAS holds bulk video. See
  [ADR 0003](docs/decisions/0003-hardware-role-split.md).

## Stack

Next.js (App Router) - TypeScript - Tailwind - Postgres - Vitest + Playwright - pnpm.

## Getting started

Requires Node 24 (see `.nvmrc`) and pnpm (`packageManager` pins the version).

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, etc.
pnpm dev                     # http://localhost:3000
```

The environment is a validated contract. `.env.schema` declares every variable and
`scripts/check-env.sh` keeps `.env.example` in lockstep with it - when you add a variable, declare
it in both places or the quality gate fails.

To run the whole system on one Mac - app, database, and video files local, without the NAS or VPS -
see [`docs/ops/local-development.md`](docs/ops/local-development.md).

## Scripts

| Command                             | What it does                         |
| ----------------------------------- | ------------------------------------ |
| `pnpm dev`                          | Start the dev server                 |
| `pnpm build` / `pnpm start`         | Production build / serve             |
| `pnpm lint`                         | ESLint                               |
| `pnpm typecheck`                    | `tsc --noEmit`                       |
| `pnpm test` / `pnpm test:watch`     | Unit tests (Vitest)                  |
| `pnpm test:e2e`                     | End-to-end tests (Playwright)        |
| `pnpm format` / `pnpm format:check` | Prettier                             |
| `pnpm wt new <type>/<slug>`         | Create a task worktree off `develop` |

## Quality gate

Run before pushing:

```bash
sh scripts/check-env.sh && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Workflow

Two long-lived branches: feature work integrates on `develop`, which is promoted to the
always-deployable `master` via a periodic release PR. Each task is its own git worktree created
with `pnpm wt new <type>/<slug>`; never commit directly to `develop` or `master`, and every change
goes through a PR into `develop`. Full details in
[`docs/engineering/git-workflow.md`](docs/engineering/git-workflow.md) and
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Documentation

- Run everything locally (no NAS/VPS): [`docs/ops/local-development.md`](docs/ops/local-development.md)
- What to build next: [`docs/project/backlog.md`](docs/project/backlog.md)
- Architecture decisions: [`docs/decisions/`](docs/decisions/)
- Engineering standards: [`docs/engineering/engineering-standards.md`](docs/engineering/engineering-standards.md)
- Conventions: [`docs/engineering/conventions.md`](docs/engineering/conventions.md)
- Quality & testing: [`docs/engineering/quality-and-testing.md`](docs/engineering/quality-and-testing.md)
- Deployment: [`docs/ops/deployment.md`](docs/ops/deployment.md)
- VPS setup (transitional single-server storage until the NAS): [`docs/ops/vps-setup.md`](docs/ops/vps-setup.md)
- Contributor guide for AI assistants and humans: [`CLAUDE.md`](CLAUDE.md)
