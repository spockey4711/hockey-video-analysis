# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

- Link players to a tag and set its visibility (P0-7). A new `tag-players` feature validates an
  untrusted `{ visibility, playerIds }` body - it dedupes player ids and requires a `single`
  (player-specific) tag to name at least one player, so a player-less `single` clip can never end up
  unreachable - and replaces a tag's whole player set plus visibility in one transaction. The
  coach-only `GET`/`PUT /api/tags/[id]/players` route exposes it, mapping a missing tag to 404 and an
  unknown player id to 400. Refs: P0-7.
- Enqueue clip cut jobs from confirmed tags and read their status
  (`src/features/clips/`, `src/app/api/clips/`, P0-9). Enqueuing inserts a
  `pending` row in `clips` - the DB-queue handoff to the hockey-video-pipeline
  worker (ADR 0003), which polls, cuts with `ffmpeg -c copy` (ADR 0004), and
  writes back `processing -> ready | failed` plus `output_path` on the same row;
  the app never calls the worker in-process. `POST /api/clips` (coach-only) is
  idempotent per tag: a tag with a live clip (`pending`/`processing`/`ready`)
  returns that clip (200) instead of queuing a duplicate cut, and only a prior
  `failed` attempt lets a fresh job be inserted (201) - an app-level guard since
  the frozen schema carries no unique constraint. `GET /api/clips?tagId=... |
?gameId=...` (coach-only) reads clip status back, per tag or as a game's
  cut-progress board joined with each source tag. Refs: P0-9.

- Resolve the UX-8 accessibility findings (A1-A5) in one pass. **A1:** lighten `--ink-400` (muted
  text) from `#6b7a8c` to `#8593a4` so it clears WCAG AA on `--surface`/`--surface-raised`/
  `--surface-hover` (5.74/5.35/4.88:1), fixing ~37 sites through the single token. **A2:** add a
  `--danger-strong` (`#cf3346`) fill for solid danger buttons so white `--danger-ink` clears AA
  (4.75:1, up from 3.22:1); `--danger` stays for danger text/borders on dark surfaces. **A3:** give
  `:focus-visible` a transparent 2px outline alongside the box-shadow glow so keyboard focus stays
  visible under forced-colors / Windows High Contrast, where the glow is dropped. **A4:** give the
  `GameCard`/`RecentGamesPeek` card-links the card's `--radius-lg` so the focus ring is rounded, not
  a rectangle around a rounded card. **A5:** document on the `Card` `interactive` prop that it is
  presentational and must sit inside a real `<a>`/`<button>`. Refs: UX-8.
- Resolve the UX-8 token findings (T1/T2/T3) in one design-system pass. **T1:** converge on the
  arbitrary-value `[var(--...)]` token form - convert the two `bg-background text-foreground`
  stragglers (`layout.tsx`, `ShareShell.tsx`) and drop the dead `@theme` color map (keeping only
  `--font-sans`), so the shipped convention and the globals.css comment agree. **T3:** add the
  missing semantic aliases `--danger-ink`, `--scrim` (a `color-mix` overlay), and `--knob` to
  `tokens/colors.css` and document them in `docs/design/README.md`. **T2:** swap the raw ramp-step
  refs for those aliases - the video backdrop uses `--surface-inset` and the buffering overlay
  `--scrim` (replacing the unreliable `/40` opacity modifier on a bare `var()`), the danger button
  uses `--danger-ink`, the Switch thumb `--knob`, and the avatar palette `--accent`/`--accent-ink`.
  Token-only: the danger-fill contrast value change stays with accessibility finding A2. Refs: UX-8.
- Add the cross-cutting design QA (`docs/design/ux-audit.md`, UX-8). A token and accessibility
  audit of the shipped app against WCAG 2.1 AA and the design system. Findings: no raw hex or
  Tailwind named-palette colors anywhere (good), but the app runs two token syntaxes side by side
  (the `@theme` color map is dead in all but two files), a few sites reach past aliases into the raw
  `--ink-*`/`--turf-*` ramp, `--text-muted` fails AA for normal text (4.1/3.8/3.5:1), the danger
  button label fails AA (3.22:1), and the box-shadow-only focus ring disappears in forced-colors
  mode. The audit records each finding with file:line and computed contrast ratios, and tracks the
  fixes as small scoped follow-up PRs per owning lane. This PR is the audit record only; no app code
  changes. Refs: UX-8.
- Compose the watch page into one coherent layout with keyboard hints
  (`src/components/watch/`, UX-6). Presentational-only chrome the watch page swaps to via imports:
  `WatchLayout` (centered max-width frame), `WatchHeader` (title over a middot-joined meta line),
  `WatchSidebar` (the beside-player rail), `WatchEmptyState` (no-video message) and `HotkeyHints` - a
  token-driven panel that documents the tagging and timeline hotkeys with `Kbd` key caps so a
  keyboard-first coach learns the shortcuts without leaving the player. `buildWatchHotkeyGroups()`
  builds the reference from the single sources of truth (the `TAG_TYPES` config for capture keys plus
  the player's native arrow-key timeline navigation), keeping the caps in lockstep with the tagging
  leaf. German copy lives in a `watchContent` layer; tokens only, no raw hex. Coordination touch: the
  player's sidebar slot was pinned to the 60px `--rail-w` (unusable for the content panels), so its
  `<aside>` now uses the `--sidebar-w` content width, making the beside-player rail readable down to a
  laptop screen. Component-tested for the header meta rules, the empty/layout composition and the
  hotkey mapping. Refs: UX-6.
- Polish the games list and create surfaces onto DS components (`src/components/games/`, UX-5). The
  games page now composes a `GamesHeader` (title, subtitle and a "plus"-iconed new-game action) and a
  `GamesList` that renders each game as an interactive `GameCard` linking into its watch view - title
  and opponent/date on the left, the chapter roll-up on the right - or a centered empty-state card
  when there are none. A route-level `loading.tsx` fallback reuses the header and swaps the body for a
  pulsing `GamesListSkeleton`, so the frame does not jump while `listGames()` resolves. The create
  page moves its accent panel and heading into a presentational `GameFormCard` wrapper around the
  existing `GameForm`. No query or route changes; German copy stays in the `gamesContent` layer
  (adding a `loading` label) and the components hold no data access. Component-tested for the list,
  empty state, watch links, roll-up fallback, skeleton status region and the form-card framing.
  Refs: UX-5.
- Fill the watch player's quarter overlay slot (`src/features/quarters/overlay/`, UX-4). A new
  `QuarterTimelineOverlay` connector bridges the live player controller into the presentational
  `QuarterMarkers`: the marker component needs the game's total length to place its bands, which is
  only known live from the video metadata, so the connector reads `durationS` off
  `usePlayerController()` and passes it through. The watch page now mounts it into the player's
  `timelineOverlay` slot and mounts the existing `QuarterEditor` beside the tagging panel, so quarter
  boundaries show on the timeline and a coach can mark them while watching (PRD 5.3). No new quarter
  logic - the bands and editor were already built in P1-4; this only wires them into the player's
  typed slots. Component-tested that the bands honour the controller's live duration. Refs: UX-4.
- Add the login-free share surface shell (`src/features/share/shell/`, UX-7). A branded, nav-free
  chrome for the secret-link team (P0-10) and per-player (P0-11) clip views: `ShareShell` frames its
  children with a brand header, a "Privater Link" badge and a private-link footer note, and carries
  no coach navigation or sign-out so a token recipient can never hop into the coach app or onto
  another player's clips (PRD 5.5, s8). The presentational state blocks - `ShareLoading`,
  `ShareEmptyState` and `ShareExpiredState` (with a reusable `ShareMessage` primitive) - cover the
  loading, empty and expired/revoked-token cases. `shareMetadata`/`shareRobots` give pages the
  `noindex, nofollow, nocache` directives every secret-link surface must carry. German copy lives in
  a `content` layer; tokens only, no raw hex. P0-10 and P0-11 render their `PlaylistPlayer` as
  `ShareShell` children. Component-tested for the framing, the no-nav guarantee and the state copy.
  Refs: UX-7.
- Replace the static homepage placeholder with an auth-aware coach landing (`src/app/page.tsx`,
  `src/features/home/`, UX-2). Signed-out visitors see the value proposition and an "Anmelden" call
  to action to `/login`; a signed-in coach is greeted by name, offered a "Zu den Spielen" action and
  shown a short peek at their most recent games (`RecentGamesPeek`, top `RECENT_GAMES_PEEK_LIMIT` of
  the newest-first `listGames()`), each row linking straight into that game's watch view with a
  fallback to the full list. The page reads the session through the read-only `getCurrentCoach()`, so
  it is now server-rendered on demand; all copy lives in the German `homeContent` layer rather than
  scattered literals, and the peek's empty/populated states are unit-tested. Refs: UX-2.
- Add the coach app shell and primary navigation (`src/components/shell/`, UX-1). A reusable
  `AppShell` reads the session through the read-only `getCurrentCoach()` and, when a coach is signed
  in, draws a top bar with the brand/home link, a `PrimaryNav`, the signed-in coach's name and the
  existing `SignOutForm`; with no session (login, signup and the login-free share surfaces) it
  renders children bare, so those pages never leak the coach chrome. `PrimaryNav` is a client leaf
  that reads the live pathname and marks the active section with `aria-current="page"` (exact or
  descendant route, driven by the pure `isNavItemActive` helper) while keeping plain `next/link`
  anchors that work without JS. The root layout now wraps its children in `AppShell`, replacing the
  inline top bar that P0-2 had put in `src/app/games/layout.tsx`; that layout is removed as
  redundant so every coach page shares one chrome. All controls reuse the DS primitives and tokens
  (no raw hex). Pure active-state logic and the nav's active marking are unit-tested. Refs: UX-1.
- Visual pass on the auth screens (`src/app/(auth)/**`, UX-3). The login and invite-signup pages
  keep their P0-2 logic but gain a shared brand lockup (an accent "H" monogram plus the wordmark)
  above the `Card`, so the standalone screens carry the same identity as the coach shell's top bar.
  The signup-disabled notice becomes a proper empty state - a muted `alert-triangle` badge over a
  centered title and body. The existing DS `Card`/`Input`/`Button` error and loading states in
  `src/features/access/**` are unchanged. Refs: UX-3.
- Plan the UI/UX wave (W6, UX-1..UX-8) in `docs/project/backlog.md`: a coach app shell and primary
  nav, an auth-aware homepage, an auth-screen visual pass, mounting the quarter overlay into the
  watch page's empty slot, games/watch presentation polish, a login-free share surface shell, and a
  token/accessibility audit. Composes the isolated W1-W5 feature lanes into one coherent, polished
  product; no application code yet. Refs: UX-1..UX-8.
- Mount the sign-out control in the coach app shell, completing P0-2. A new `/games` layout
  (`src/app/games/layout.tsx`) wraps every authenticated coach surface (games list, create, watch)
  in a top bar showing the brand, the signed-in coach's name and a `SignOutForm`
  (`src/features/access/`). The form posts to the existing `logoutAction` server action - a real
  POST that works without client JS - which invalidates the session, clears the cookie and
  redirects to login; its submit button disables itself via `useFormStatus` while the action runs.
  The bar reads the session through the read-only `getCurrentCoach()` and only renders once a coach
  is present, so unauthenticated hits still fall through to each page's `requireCoach()` redirect.
  Refs: P0-2.
- Re-source `TagChip` from the P1-3 tag-type config and delete the DS-3 stand-in
  (`src/components/data/tag-types.ts`). The chip's `type` prop now takes real `tags.type` keys
  (`goal`/`corner_short`/`action_good`/`action_bad`) and reads its default German label from
  `getTagType`, so it renders live tags directly; P1-3 exports a `TagTypeKey` literal union for the
  typed prop. The `whistle` (AI double-whistle suggestion) chip stays as a component variant with a
  locally owned label, since a suggestion is a `tags.source`, not a `tags.type`. Refs: DS-3, P1-3.
- Add the quarter split (`src/features/quarters/`, `src/app/api/quarters/`, P1-4). A coach marks each
  quarter's start on the global game timeline (ADR 0002) to enable timeline navigation and per-quarter
  clip creation (PRD 5.3). The pure navigation module maps a game-time offset to its quarter
  (`quarterAt`, half-open intervals so a boundary belongs to the next span), resolves a quarter's clip
  window (`quarterWindow` - explicit end, else the next quarter's start, else the game end, clamped to
  the game length) for the clip flow (P0-9), and lays out timeline bands (`quarterBands`). The
  coach-only `GET`/`PUT /api/quarters` reads and replaces a game's boundaries as a whole set: the
  untrusted `PUT` body is validated (a contiguous `1..N` run of strictly ordered, non-overlapping
  quarters) before `replaceQuarters` swaps the `quarters` rows in one transaction. The `QuarterEditor`
  sidebar leaf marks starts from the live player time and jumps back to any quarter, saving through the
  route handler (never a direct DB call from the client), and `QuarterMarkers` draws the boundaries
  over the player's timeline slot. Pure navigation, validation, and draft shaping are unit-tested, plus
  component tests for the editor and markers. Refs: P1-4.
- Add hotkey tagging. A single keypress captures the current global game time plus a tag type and
  saves it, applying that type's default clip window (PRD 5.2). Lands the configurable tag-type
  module (`src/lib/tag-types/`, P1-3): the type set (Tor, Ecke kurz, Aktion gut, Aktion schlecht),
  each type's hotkey and default lead-in/follow-through window live in one config that the UI reads
  rather than hard-coding, and `getTagType`/`isTagTypeKey`/`tagTypeForHotkey` resolve keys and
  hotkeys (the config self-validates its keys, hotkeys, and windows at load). The `HotkeyTagger`
  capture leaf (`src/features/tagging/`) listens for the bound keys - ignoring modifiers and
  text-entry focus - reads live game-time through a `getCurrentTimeS` prop so it stays decoupled
  from the player (P0-5 mounts it into the watch page's tagging slot), and shows a hotkey legend
  plus an aria-live capture confirmation. The pure `captureTag` window math (start/end clamped to
  the game bounds) is unit-tested, and the coach-only `POST /api/tags` route validates the untrusted
  body, rejects unknown tag types, and stamps `author` from the session and `source: manual`
  server-side. Refs: P0-6, P1-3.
- Mount hotkey tagging into the watch page. A new `TaggingPanel`
  (`src/features/tagging/`) fills the player's `sidebar` slot, reads the live player controller
  (frame-current game time and total duration), and forwards them to the `HotkeyTagger` leaf, so
  a coach watching a game can now capture tags by keypress. Refs: P0-6.
- Fix `next build` failing without a database. The DB client (`src/lib/db/`) now connects lazily
  on first query instead of throwing at module import when `DATABASE_URL` is unset. Build-time
  page-data collection imports server modules (pages, route handlers) that transitively reach the
  client, so an eager throw broke the build (e.g. `/login`, `/signup`) in CI, which runs `pnpm
build` without a database. The check now fires at request time, where a missing connection
  string is a genuine misconfiguration. Callers use `db` unchanged.
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
