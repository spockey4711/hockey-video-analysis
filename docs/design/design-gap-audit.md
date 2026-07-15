# Design-quality gap audit

Scoping document for backlog `P2-8` ("close the design gap to the reference system"). The shipped
UI is noticeably rougher than the **"Hockey Video Analysis Design System"** it was ported from. This
file is the screen-by-screen gap list; the fixes land afterwards as **small, scoped PRs in each
screen's owning lane** (see [Follow-up PRs](#follow-up-prs)). This document is the single source that
tracks them - check items off here as the fix PRs merge.

- **Audited:** `develop`, 2026-07-15.
- **Method:** static review of every page and component in `src/**` against the in-repo design
  contract - `docs/design/README.md` (brand foundations, component catalogue) and the token set in
  `src/styles/tokens/`. Each finding cites the exact site(s) so the fix is unambiguous.
- **Scope boundary vs `UX-8`.** The `ux-audit.md` sweep covered raw-color/token drift and WCAG
  contrast/focus; those fixes have landed. This audit is the _visual-quality_ layer on top:
  typography hierarchy, spacing rhythm, surface/elevation consistency, component polish, and motion.
  There is minimal overlap - where one exists it is noted.
- **Caveat.** This compares the shipped app to the design system's **documented** contract (the
  README spec + tokens), not a live visual diff against the canonical claude.ai design project (not
  reachable from here). Findings are grounded in the spec the repo already commits to; when the
  design project is re-imported, re-check G9/G10 and any spacing values against the source frames.

## Summary

| ID  | Area             | Finding                                                                     | Severity | Owning lane   |
| --- | ---------------- | --------------------------------------------------------------------------- | -------- | ------------- |
| G1  | Typography       | Saira display font is never applied to page headings - all render in body   | High     | Design system |
| G2  | Typography       | `--fs-heading` token is undefined; Games & Roster titles fall back to body  | High     | Design system |
| G3  | Surfaces         | Two competing panel treatments (`Card` vs hand-rolled `<section>`)          | Medium   | Design system |
| G4  | Components       | No shared section/panel header; the HUD caption header is duplicated inline | Medium   | Design system |
| G5  | Depth            | Elevation scale barely used - only `--shadow-sm`; `-lg`/`-pop` are dead     | Medium   | Design system |
| G6  | Empty states     | Empty/placeholder states are bare muted text - no icon, title, hierarchy    | Medium   | Various       |
| G7  | Typography       | Non-token letter-spacing (`tracking-wide`/`widest`) instead of `--ls-*`     | Low      | Home          |
| G8  | Typography       | Type scale underused; page-title size is inconsistent across screens        | Low      | Design system |
| G9  | Brand background | Pitch-green radial video backdrop + faint stripes (spec) not implemented    | Deferred | Player        |
| G10 | Motion           | `--glow-live` reserved but unused - no live/REC affordance                  | Deferred | Player        |

Bottom line: the token foundation is strong and disciplined (no raw hex, consistent alias use), but
the components under-apply it. Two **High** findings (G1, G2) are single-token/single-utility fixes
that lift the whole app's heading hierarchy at once and should land first.

## Cross-cutting findings

### G1 - The display typeface never reaches page headings (High)

`docs/design/README.md` (Brand foundations > Type): _"Saira (technical, semi-condensed, athletic)
for display headings and UPPERCASE labels."_ Saira is loaded (`tokens/fonts.css`) and aliased
(`--font-display`), but in `src/**` it is applied to only three places - the auth monogram block
(`app/(auth)/layout.tsx:24`), `TagChip` (`components/data/TagChip.tsx:97`) and the `PlayerChip`
avatar (`components/data/PlayerChip.tsx:49`). **Every actual page heading renders in Hanken Grotesk
(the body font):**

- `app/page.tsx:32` - home `h1` (`--fs-display`)
- `components/watch/WatchHeader.tsx:22` - watch `h1` (`--fs-h2`)
- `features/share/shell/ShareShell.tsx:45` - share `h1` (`--fs-h2`)
- `components/games/GamesHeader.tsx:17` - games `h1`
- `components/players/RosterHeader.tsx:11` - roster `h1`
- `components/players/PlayerRow.tsx:33` - player-row `h2` (`--fs-title`)

Headings also never use the heading tracking or line-height the scale defines: `--ls-tight` is
**used nowhere** in `src/**`, and headings inherit `--lh-body` (1.55) rather than `--lh-heading`
(1.15) / `--lh-tight` (1.05). The result is the single biggest reason the app reads softer and less
"athletic/broadcast" than the reference: the brand voice lives in the display face, and no heading
uses it.

**Recommendation:** give headings Saira + `--ls-tight` + a heading line-height in one place. Options:
(a) a small `Heading` primitive (`level`/`size`) added to the core catalogue, or (b) base-layer
`h1..h3` rules in `globals.css`. A primitive is cleaner given the per-screen size differences (G8);
either way this is one design-system change that every screen inherits.

### G2 - `--fs-heading` is undefined; two page titles silently fall back to body size (High)

`components/games/GamesHeader.tsx:17` and `components/players/RosterHeader.tsx:11` both set
`text-[length:var(--fs-heading)]`, but **there is no `--fs-heading` token** - the scale defines
`--fs-display/h1/h2/h3/title/...` only. The `var()` resolves to nothing, so the utility is dropped
and both titles render at the inherited body size (`--fs-body`, 15px). The primary heading on the
Games list and the Roster - two of the app's main screens - is not visually a heading at all.

**Recommendation:** point both at a real step (`--fs-h2` matches the Watch and Share titles; see G8),
folded into the G1 heading work. Consider a lint/CI guard for references to undefined `--fs-*`/
`--space-*` tokens so this class of typo can't ship silently again.

### G3 - Two competing panel treatments (Medium)

The app has a `Card` primitive (`rounded-[--radius-lg]` 12px, `bg-[--surface]`, `--border-subtle`,
`--shadow-sm`) used across the marketing/list surfaces (home, games, roster, auth, share -
10 sites). But the **workspace panels hand-roll a different `<section>`** -
`rounded-[--radius-md]` (8px) + full `--border` + `bg-[--surface-raised]`, no shadow - in at least
seven places: `watch/ClipBoard.tsx:110`, `watch/HotkeyHints.tsx:40`,
`features/quarters/QuarterEditor.tsx`, `features/tagging/HotkeyTagger.tsx`,
`features/tagging/edit/TagList.tsx`, `features/suggestions/SuggestionReview.tsx`,
`features/player/jump-markers/JumpMarkerNav.tsx`. So the radius, border weight, surface token and
elevation of a "panel" differ depending on which screen you are on - the watch sidebar and the games
list do not feel like the same system.

**Recommendation:** decide one panel contract. Either extend `Card` with a `variant` (e.g. `panel`
= raised surface, tighter radius) or align the workspace panels onto `Card`. Then migrate the seven
hand-rolled sections. This is the highest-leverage consistency fix after typography.

### G4 - No shared section/panel header component (Medium)

The panels in G3 each re-implement the same HUD header inline: a `--fs-caption`/`--fs-micro`
UPPERCASE `--ls-caps` title over an optional muted hint line (`ClipBoard.tsx:112-119`,
`HotkeyHints.tsx:42-49`, and the same shape in `QuarterEditor`, `TagList`, `SuggestionReview`). It
is duplicated markup with small drifts (h2 vs h3, caption vs micro), and the reference treats the
panel header as one component.

**Recommendation:** add a `SectionHeading`/`PanelHeader` to the catalogue (`title`, `hint`,
optional `action` slot) and use it in the G3 migration. Removes duplication and locks the caption
scale/tracking so panels stay uniform.

### G5 - The elevation scale is barely used; depth hierarchy is flat (Medium)

`tokens/effects.css` defines a four-step shadow ramp (`--shadow-sm/md/lg/pop`) plus the reference's
"deep cool shadows" language. In practice `src/**` uses **`--shadow-sm` (5 sites) and `--shadow-md`
once** (the interactive-card hover lift); `--shadow-lg` and `--shadow-pop` are **dead**. Everything
sits at one elevation, and the workspace panels (G3) carry no shadow at all. Nothing reads as
"raised" - modals/menus/popovers, when they exist, have no elevation vocabulary to draw on.

**Recommendation:** apply the ramp deliberately - resting cards `sm`, hover/active `md`, any
overlay/menu `lg`/`pop`. Fold the panel elevation into the G3 decision. Small, per-surface, but it
restores the layered depth the reference has.

### G6 - Empty and placeholder states are bare muted text (Medium)

Empty states are a single centered line of `--text-muted` with no icon, no title, no structure:
`components/games/GamesList.tsx:16` (no games), `watch/WatchEmptyState.tsx:12` (no video),
`watch/ClipBoard.tsx:122` (no tags), `features/home/RecentGamesPeek.tsx:38` (no recent games). A
reference-grade empty state pairs a Lucide glyph with a short title and a one-line hint (and often
the primary action). These are among the first things a new coach sees, so the roughness is
disproportionately visible.

**Recommendation:** a small `EmptyState` component (`icon`, `title`, `hint`, optional `action`) in
the catalogue, adopted per screen in each owning lane. Note: `--text-muted` at body size is a known
AA edge (UX-8/A1, since retuned) - keep empty-state copy at `--text-secondary` for the title.

### G7 - Non-token letter-spacing on eyebrow/label text (Low)

Two UPPERCASE labels use Tailwind's built-in tracking instead of the caps tokens: `app/page.tsx:29`
(`tracking-widest`) and `features/home/RecentGamesPeek.tsx:26` (`tracking-wide`). The scale defines
`--ls-caps` (0.12em) and `--ls-wide` (0.04em) for exactly this; the built-ins are close but off, so
the HUD labels are subtly inconsistent with the token-correct ones (e.g. `Input`'s label,
`HotkeyHints`).

**Recommendation:** swap both to `tracking-[var(--ls-caps)]`. Trivial; bundle with the Home lane.

### G8 - Type scale underused; page-title size differs by screen (Low)

Of the display/heading steps (`--fs-display` 56, `--fs-h1` 40, `--fs-h2` 30, `--fs-h3` 22), only
`--fs-display` and `--fs-h2` appear on real headings; `--fs-h1` is **used nowhere** and `--fs-h3`
only on the auth monogram. Consequently the _page title_ is a different size on every screen: home
`--fs-display`, watch/share `--fs-h2`, games/roster the broken `--fs-heading` (G2). There is no
consistent "page-title" rung.

**Recommendation:** define the page-title size once (as part of the G1 `Heading` primitive) and
apply it uniformly - reserve `--fs-display` for the marketing hero only. Resolves G2's target and
gives the workspace a single title scale.

### G9 - Pitch-green video backdrop not implemented (Deferred / brand)

`README.md` (Backgrounds): _"the video area is a dark radial-green 'pitch' with faint vertical
stripes."_ `features/player/ContinuousPlayer.tsx:66,77` render the video area as flat
`bg-[var(--surface-inset)]`. The branded pitch backdrop (visible in letterboxing and while a chapter
loads) is not built. Low urgency - it is texture behind a video that usually fills the frame - but it
is a named brand element the reference has and the app does not.

**Recommendation:** add the radial-green + stripe background as a token-driven utility on the player
frame when the design project's exact gradient/stripe values are available. Player lane; defer until
G1-G6 land.

### G10 - `--glow-live` reserved but unused (Deferred / confirm scope)

`tokens/effects.css` defines `--glow-live` for "live/recording affordances"; it is applied nowhere.
This product tags **already-recorded** games (no live capture), so there may be no live/REC state to
decorate - in which case the token is dead by design, not a gap.

**Recommendation:** confirm with the product owner whether any live/REC affordance is planned. If
not, drop `--glow-live` and its README mention; if so, that lane owns the fix. No code change until
decided.

## Screen-by-screen gap list

Each screen lists the cross-cutting findings that hit it plus any screen-specific note. Owning lane
in brackets.

### Home / landing - `app/page.tsx`, `features/home/**` [Home]

- G1 (hero `h1` in body font), G7 (`tracking-widest` eyebrow), G6 (`RecentGamesPeek` empty state).
- Screen note: the signed-out feature cards (`page.tsx:64-77`) are a flat 3-up grid of muted text -
  no icon, no `accent` edge, no hover. Given `Card` supports `accent` and `interactive`, this is the
  most "template-default" surface in the app and the clearest quick win for hierarchy.

### Games list - `app/games/page.tsx`, `components/games/**` [Games]

- G2 (`GamesHeader` title falls back to body size - most visible instance), G1, G5 (cards rest at
  `--shadow-sm`, hover lifts to `--shadow-md` - the one place the ramp is used, so this screen is the
  reference for G5), G6 (no-games empty state).
- Screen note: `GameCard` hierarchy is otherwise good (semibold title, muted meta, mono duration,
  chevron). Skeleton (`GamesListSkeleton.tsx`) faithfully mirrors the row footprint - keep it in sync
  if the card padding/radius changes.

### Watch workspace - `components/watch/**`, `features/tagging/**`, `features/player/**` [Watch / Tagging / Player]

- G1 (`WatchHeader` title in body font), G3 + G4 + G5 (the sidebar panels - `ClipBoard`,
  `HotkeyHints`, tagging/quarter panels - are the hand-rolled `<section>` treatment with no shadow),
  G6 (`WatchEmptyState`, `ClipBoard` empty), G9/G10 (player).
- Screen note: this is the densest, most important screen and where the panel inconsistency (G3/G4)
  is most felt - the sidebar reads as a different design language from the list screens. Transport
  chrome and scrubber are solid (real `<button>`s, mono clock, tabular-nums); the gap here is
  surface/elevation consistency, not the controls.

### Share (login-free) - `features/share/**` [Share]

- G1 (`ShareShell` title in body font).
- Screen note: the shell is otherwise well-composed (branded header with private badge, footer note,
  consistent max-width and padding). Once G1 lands it is close to reference. Keep the `noindex`/
  no-nav guarantees intact - do not add cross-surface links while polishing.

### Players roster - `app/players/page.tsx`, `components/players/**` [Players]

- G2 (`RosterHeader` title falls back to body size), G1, G3 (rows use `Card`, good), G6.
- Screen note: `PlayerRow` composes cleanly (name + jersey, share field, coach controls). The title
  fix (G2) is the main visible gap.

### Auth (login / signup) - `app/(auth)/**`, `features/access/**` [Access]

- G1 does **not** hit these strongly: the brand lockup uses the display font and forms are correctly
  wrapped in `Card` (`login/page.tsx:33` uses `Card accent`). Lowest-priority screen.
- Screen note: no gaps beyond inheriting the G1 `Heading` primitive if page-level headings are added.

## Follow-up PRs

Each fix lands as its own scoped PR into `develop`, referencing `P2-8`. Owning lane in brackets.
Land the two typography fixes first (highest payoff, lowest risk), then the surface/elevation work,
then per-screen polish. Tick as merged, and update `CHANGELOG.md` with each.

- [x] **G1 + G2 + G8** - add a `Heading` primitive (Saira + `--ls-tight` + heading line-height + a
      single page-title size), replace the six heading sites, retire `--fs-heading`. [design system]
- [ ] **G3 + G5** - decide the one panel contract (extend `Card` with a `panel` variant + deliberate
      elevation) and migrate the seven hand-rolled workspace `<section>`s. [design system, then watch /
      tagging / quarters / suggestions / player]
- [ ] **G4** - add `SectionHeading`/`PanelHeader` to the catalogue; adopt in the G3 migration.
      [design system]
- [ ] **G6** - add an `EmptyState` component; adopt on home, games, watch, clip board. [design
      system, then per screen]
- [ ] **G7** - swap `tracking-wide`/`widest` for `--ls-caps` on the home eyebrow and recent heading.
      [home]
- [ ] **G9** - implement the pitch-green radial + stripe video backdrop from the design project's
      values. [player] (deferred)
- [ ] **G10** - confirm whether a live/REC affordance is in scope; keep or drop `--glow-live`
      accordingly. [player] (deferred, needs product decision)

Update this checklist and `CHANGELOG.md` as each PR merges.
