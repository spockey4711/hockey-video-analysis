# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

- Add the continuous multi-chapter player and the coach watch page
  (`src/app/games/[id]/watch/`, `src/features/player/`). A game's N ordered chapter files play
  through a single `<video>` element as one seamless game timeline: the element's `src` is swapped
  at each chapter boundary (resume the next chapter at its start) and a seek that lands in another
  chapter loads it, then applies the local offset once its metadata is ready - so the coach only
  ever scrubs global game time, never file time (PRD 5.2, ADR 0002). The `(chapter, local offset)`
  mapping is confined to the player, which builds on the P0-4 time-mapping contract via a pure
  `planSeek` transition helper. NAS `game_sources.file_path` values are resolved to playable URLs
  server-side against the new optional `MEDIA_BASE_URL` env var (added to the env contract), so the
  raw NAS layout never ships to the browser. The watch page is the shared player shell and leaves
  typed slots for the sibling lanes to compose without editing it: a published `usePlayerController`
  hook plus `videoOverlay` / `timelineOverlay` / `sidebar` / `transportExtras` slots for hotkey
  tagging (P0-6) and the quarter overlay (P1-4). Unit tests cover the pure source resolution,
  timecode formatting, and seek/boundary transitions, plus a component test for the shell wiring,
  slots, and controller context. Refs: P0-5.
- Add creating a game with its ordered chapter files (`src/features/games/`, `/games` and
  `/games/new`). A coach enters title, optional opponent and played-on date, then references
  1..N source file paths in order with each file's duration in seconds - the files already live
  on the NAS, so nothing is re-uploaded. Creation runs behind `requireCoach()` and persists the
  game plus its `game_sources` rows in one transaction, stamping each chapter's `order_index`
  from its position so the global game-time mapping (ADR 0002) has stable, ordered durations. Pure
  input validation (`validateGame`, per-row source errors, a German decimal comma accepted for
  durations) is unit-tested and shared by the server action; the list page shows every game with
  its chapter count and total length, and `GET /api/games` exposes the same list as coach-only
  JSON for client components. Refs: P0-3.
- Build the design-system domain components in production React/TS + Tailwind, styled from the
  design tokens (no raw hex), under `src/components/data/`: `TagChip`, `StatusBadge`, `Timecode`,
  `PlayerChip`, and `Kbd`. `Timecode` formats a global game-time offset per the P0-4 time-mapping
  contract (pure `formatGameTime` helper: auto `H:MM:SS` / `M:SS`, optional accent hundredths,
  clamps non-finite/negative to zero). `TagChip` reads its tag-type set and German labels from a
  config module; because P1-3 has not landed yet, that module ships as a narrow local stand-in
  (`data/tag-types.ts`) to be re-sourced from `src/lib/tag-types/` when P1-3 exists. `StatusBadge`
  pulses while `processing`; `PlayerChip` derives deterministic, token-based avatar colors and
  initials from the player name. Adds unit tests for each component and the pure helpers. Refs: DS-3.
- Document how to run the whole system on a single Mac - app, local Postgres, and video files in a
  local folder - without the NAS or VPS (`docs/ops/local-development.md`), and link it from the
  README. Clarifies that the three-machine split (ADR 0003) is a deployment choice: the database URL
  and file paths are the only things that re-home when you later move to the VPS/M4/NAS topology, so
  no application code changes.
- Add coach login. Coaches authenticate with email + password to create and edit content, while
  players and the team keep login-free read access via secret links. Passwords are hashed with
  Node's memory-hard `scrypt` (self-describing cost params, constant-time verify); sessions are
  opaque 256-bit tokens stored only as their SHA-256 hash in `sessions`, carried in an HttpOnly,
  SameSite=Lax, Secure-in-production cookie with a fixed 30-day lifetime. `src/middleware.ts` does a
  coarse cookie-presence redirect at the edge; `requireCoach()` is the authoritative DB-validated
  guard and `getCurrentCoach()` the shared read later tasks use to stamp `author`. Self-registration
  at `/signup` is gated by `AUTH_INVITE_CODE` (disabled when unset); login is rate-limited per
  IP+email and errors stay generic to avoid account enumeration. Adds `AUTH_INVITE_CODE` to the env
  contract, ADR 0005, unit tests for the pure logic (hashing, tokens, validation, invite gating,
  rate limiting), and a Vitest `server-only` stub so server modules are testable. Refs: P0-2.
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
