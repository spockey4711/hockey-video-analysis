# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

- Document how to run the whole system on a single Mac - app, local Postgres, and video files in a
  local folder - without the NAS or VPS (`docs/ops/local-development.md`), and link it from the
  README. Clarifies that the three-machine split (ADR 0003) is a deployment choice: the database URL
  and file paths are the only things that re-home when you later move to the VPS/M4/NAS topology, so
  no application code changes.
- Fix the CSS import order that broke the app build and the Playwright smoke gate. The remote
  Google Fonts `@import` (in `src/styles/tokens/fonts.css`) was pulled in after
  `@import "tailwindcss"`, which expands inline to real style rules; CSS requires every `@import`
  to precede all rules, so Lightning CSS rejected the stylesheet and the dev server served a 500,
  timing out the smoke job's web-server wait. Import `fonts.css` before Tailwind so the webfont
  `@import` stays first. Also add the first real smoke spec (`tests/e2e/home.smoke.spec.ts`)
  asserting the home page responds `200` and renders its hero heading, so an unrenderable page
  fails fast with a clear assertion instead of a web-server timeout.
- Add the global game-time mapping utility (`src/lib/time-mapping/`): a pure,
  DB-free conversion between a global game-time offset and a `(source file, local
offset)` pair, computed from the ordered `game_sources.duration_s` durations
  (`toSourcePoint`, `toGameTime`, `totalDurationS`). This is the shared contract
  with the pipeline worker (ADR 0002); interior chapter boundaries resolve to the
  start of the next chapter and the exact game end resolves to the last chapter's
  end, with unit tests pinning the boundary and round-trip semantics. Refs: P0-4.
- Build the design-system primitive components in production React/TS + Tailwind, styled from the
  design tokens (no raw hex): `Card` and `Icon` under `src/components/core/`, and `Button`,
  `IconButton`, `Input`, `Select`, `Switch` under `src/components/forms/`. `Icon` wraps a curated,
  tree-shakeable Lucide glyph set; a `cn` helper (tailwind-merge) lets callers override classes.
  Adds `lucide-react` and `tailwind-merge`, and component unit tests under `tests/unit/components/`.
  Refs: DS-2.
- Fix the lint/type toolchain, which was broken repo-wide by bleeding-edge major
  versions the plugin stack does not yet support. Pin `typescript` to `6.0.3`
  (the native TypeScript 7 port is unsupported by `@typescript-eslint`, whose
  peer caps at `<6.1.0`) and `eslint` to `^9.39.5` (ESLint 10 removed the
  deprecated context APIs `eslint-plugin-react` still calls). Migrate
  `eslint.config.mjs` off the broken `FlatCompat` shim to the native flat-config
  exports of `eslint-config-next`, drop the now-unused `@eslint/eslintrc`, and
  align `setup.sh` so fresh scaffolds do not regenerate the break. `pnpm lint`,
  `typecheck`, `test`, and `build` all pass again.
- Sharpen the backlog-marker convention in the git workflow and backlog docs: tick a task's box
  before the merge PR (not after), use `- [~]` whenever concrete steps still remain (a CLI
  command, server/route wiring, a follow-up) and `- [x]` only when nothing is left, and never
  leave a started task `- [ ]`.
- Track `.env.schema` in git (un-ignore it in `.gitignore`). The broad `.env.*`
  ignore rule was hiding the schema, so a fresh CI clone had no schema file and
  `scripts/check-env.sh` exited green without validating anything - the env
  contract was documented but never enforced.
- Stand up the Next.js app shell (root layout, landing page, Tailwind v4 design
  tokens, `output: "standalone"`) and the full Postgres schema via Drizzle: all
  tables (`coaches`, `sessions`, `games`, `game_sources`, `players`, `tags`,
  `tag_players`, `clips`, `comments`, `quarters`, `whistle_candidates`) with the
  initial migration under `drizzle/`, a server-only db client, and the `postgres`
  (compose `db` service) and `auth` flavors wired. Refs: P0-1.
- Import the design-system foundation from the claude.ai design project: dark-first design tokens
  (`src/styles/tokens/*.css`), a global entry stylesheet (`src/styles/globals.css`), and a
  `docs/design/` reference covering brand foundations, copy rules, iconography, the component
  catalogue, and provenance caveats (no real logo, Google Fonts substitutes, approximate brand
  green). Adds design-system tasks DS-1..DS-3 to the backlog waves.
- Project scaffolded from DevBlueprint (Web app (Next.js + pnpm)).
- Tailor `CLAUDE.md` to the project: add a domain summary, make stack notes concrete
  (global game-time model, secret-link safety, db/auth flavors), and sharpen the workflow
  rules - every code change in its own worktree, and agents push/open PRs while only the
  human merges.
- Group the backlog into five parallel execution waves (4 lanes) with per-task `[W1]`..`[W5]`
  badges and per-task owned-path assignments, so four instances can work a wave concurrently
  with minimal merge conflicts.
- Fix the CI install gate: allowlist the `unrs-resolver` native build script via pnpm 11's
  `allowBuilds` so `pnpm install --frozen-lockfile` no longer exits with
  ERR_PNPM_IGNORED_BUILDS.
- Pass a `GITHUB_TOKEN` to the gitleaks action, which now requires it to scan pull requests.
- Let `pnpm test` pass on the empty scaffold (`vitest --passWithNoTests`) until the first tests
  land, and ignore `*.tsbuildinfo`.
