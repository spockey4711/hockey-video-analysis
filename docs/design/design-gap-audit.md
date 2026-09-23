# Design-quality gap audit

Scoping document for backlog `P2-8` ("close the design gap to the reference system"). The shipped
UI is noticeably rougher than the **"Hockey Video Analysis Design System"** it was ported from. This
file is the screen-by-screen gap list; the fixes land afterwards as **small, scoped PRs in each
screen's owning lane** (see [Follow-up PRs](#follow-up-prs)). This document is the single source that
tracks them - check items off here as the fix PRs merge.

- **Audited:** `develop`, 2026-07-15 (G1-G11). [Round 2](#round-2---screens-shipped-since-july)
  (G12-G21) re-audited `develop` on 2026-09-23 for the screens that shipped after the first pass.
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
| G1  | Typography       | Saira display font is never applied to page headings - all render in body   | Done     | Design system |
| G2  | Typography       | `--fs-heading` token is undefined; Games & Roster titles fall back to body  | Done     | Design system |
| G3  | Surfaces         | Two competing panel treatments (`Card` vs hand-rolled `<section>`)          | Done     | Design system |
| G4  | Components       | No shared section/panel header; the HUD caption header is duplicated inline | Done     | Design system |
| G5  | Depth            | Elevation scale barely used - only `--shadow-sm`; `-lg`/`-pop` are dead     | Done     | Design system |
| G6  | Empty states     | Empty/placeholder states are bare muted text - no icon, title, hierarchy    | Medium   | Various       |
| G7  | Typography       | Non-token letter-spacing (`tracking-wide`/`widest`) instead of `--ls-*`     | Done     | Home          |
| G8  | Typography       | Type scale underused; page-title size is inconsistent across screens        | Done     | Design system |
| G9  | Brand background | Pitch-green radial video backdrop + faint stripes (spec) not implemented    | Done     | Player        |
| G10 | Motion           | `--glow-live` reserved but unused - no live/REC affordance                  | Done     | Player        |

Bottom line: the token foundation is strong and disciplined (no raw hex, consistent alias use), but
the components under-apply it. Two **High** findings (G1, G2) are single-token/single-utility fixes
that lift the whole app's heading hierarchy at once and should land first.

## Cross-cutting findings

### G1 - The display typeface never reaches page headings (High)

`docs/design/README.md` (Brand foundations > Type): _"Saira (technical, semi-condensed, athletic)
for display headings and UPPERCASE labels."_ Saira is loaded (`styles/fonts.ts`) and aliased
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

**Resolution:** the `Heading` primitive (`components/core/Heading.tsx`) is the one place headings
get Saira (`--font-display`), `--lh-heading` and the rung's tracking (`--ls-tight` for titles). A
re-check on `develop` (2026-09-25) found it adopted on the audited pages but not on the ~20 headings
added since (auth, collections, game review, incoming games, home sections, comment thread, watch top
bar and tags rail, team share link, presentation title card and notes); all of them now render
through `Heading`, and `PanelHeader` composes it too.

### G2 - `--fs-heading` is undefined; two page titles silently fall back to body size (High)

`components/games/GamesHeader.tsx:17` and `components/players/RosterHeader.tsx:11` both set
`text-[length:var(--fs-heading)]`, but **there is no `--fs-heading` token** - the scale defines
`--fs-display/h1/h2/h3/title/...` only. The `var()` resolves to nothing, so the utility is dropped
and both titles render at the inherited body size (`--fs-body`, 15px). The primary heading on the
Games list and the Roster - two of the app's main screens - is not visually a heading at all.

**Recommendation:** point both at a real step (`--fs-h2` matches the Watch and Share titles; see G8),
folded into the G1 heading work. Consider a lint/CI guard for references to undefined `--fs-*`/
`--space-*` tokens so this class of typo can't ship silently again.

**Resolution:** `--fs-heading` is gone; the Games and Roster titles use the `page` rung (`--fs-h2`).
`tests/unit/components/design-token-refs.test.ts` now fails on any `var()` reference to an
undeclared `--fs-*`/`--lh-*`/`--ls-*`/`--fw-*`/`--space-*` token, so this class of typo can't ship
silently again.

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

**Resolution:** a re-check on `develop` (2026-09-25) found the first pass had added a raised
`Card panel` variant, but after the G11 rebuild it survived only on document pages (settings sections,
the report breakdown tables) beside resting cards on the same screens, and inside the watch timeline's
quarter popover, where it drew a second frame within the popover's own border. There is now exactly
one panel treatment: `Card` (`--radius-lg`, `--border-subtle`, `--surface`). The `panel` variant is
gone and those surfaces are resting cards; the quarter editor renders as plain content inside its
popover; the collection clip picker, the share-link empty/expired and loading states are `Card`s
instead of a bare form and hand-rolled boxes; the report skeleton mirrors the resting card.

### G4 - No shared section/panel header component (Medium)

The panels in G3 each re-implement the same HUD header inline: a `--fs-caption`/`--fs-micro`
UPPERCASE `--ls-caps` title over an optional muted hint line (`ClipBoard.tsx:112-119`,
`HotkeyHints.tsx:42-49`, and the same shape in `QuarterEditor`, `TagList`, `SuggestionReview`). It
is duplicated markup with small drifts (h2 vs h3, caption vs micro), and the reference treats the
panel header as one component.

**Recommendation:** add a `SectionHeading`/`PanelHeader` to the catalogue (`title`, `hint`,
optional `action` slot) and use it in the G3 migration. Removes duplication and locks the caption
scale/tracking so panels stay uniform.

**Resolution:** `PanelHeader` (title, hint, `action`) is the one panel header. The re-check found a
second hand-rolled variant - a `sub` title over a muted hint - on the login, signup, new-game and
game-review cards, the settings sections, the team link and the add-player card, plus inline
eyebrow-and-hint headers on the incoming-games list and the review chapters. `PanelHeader` gained a
`size` (`eyebrow` for tool and data panels, `sub` for form and settings cards) and a `titleId` for
`aria-labelledby`, and all of them now render through it, so the title rung, the title-to-hint gap and
the hint treatment are set in one place.

### G5 - The elevation scale is barely used; depth hierarchy is flat (Medium)

`tokens/effects.css` defines a four-step shadow ramp (`--shadow-sm/md/lg/pop`) plus the reference's
"deep cool shadows" language. In practice `src/**` uses **`--shadow-sm` (5 sites) and `--shadow-md`
once** (the interactive-card hover lift); `--shadow-lg` and `--shadow-pop` are **dead**. Everything
sits at one elevation, and the workspace panels (G3) carry no shadow at all. Nothing reads as
"raised" - modals/menus/popovers, when they exist, have no elevation vocabulary to draw on.

**Recommendation:** apply the ramp deliberately - resting cards `sm`, hover/active `md`, any
overlay/menu `lg`/`pop`. Fold the panel elevation into the G3 decision. Small, per-surface, but it
restores the layered depth the reference has.

**Resolution:** the ramp now has one meaning per step, documented in the README: `--shadow-sm` for
resting cards, `--shadow-md` for the hover lift of an `interactive` card, `--shadow-lg` for a floating
layer anchored to a trigger (the new `Card` `overlay`, used by the watch timeline's disclosure
popover) and `--shadow-pop` for a modal dialog. `--shadow-md` no longer doubles as a static "raised
panel" level, which is what made the report and settings pages mix two elevations. The one modal in
the app, the clip editor's clip picker (`features/clip-editor/picker/PickerDialog.tsx`), still rests
at `--shadow-lg`; moving it to `--shadow-pop` is left to the clip editor lane, which owns that code.

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

**Resolution:** both labels use `--ls-caps`, and every eyebrow/section label now goes through the
`Heading` `eyebrow` rung (which owns `--ls-caps`). The last non-token rhythm utility, `leading-relaxed`
on legal prose, is `--lh-body`; no built-in `tracking-*` steps remain in `src/**`.

### G8 - Type scale underused; page-title size differs by screen (Low)

Of the display/heading steps (`--fs-display` 56, `--fs-h1` 40, `--fs-h2` 30, `--fs-h3` 22), only
`--fs-display` and `--fs-h2` appear on real headings; `--fs-h1` is **used nowhere** and `--fs-h3`
only on the auth monogram. Consequently the _page title_ is a different size on every screen: home
`--fs-display`, watch/share `--fs-h2`, games/roster the broken `--fs-heading` (G2). There is no
consistent "page-title" rung.

**Recommendation:** define the page-title size once (as part of the G1 `Heading` primitive) and
apply it uniformly - reserve `--fs-display` for the marketing hero only. Resolves G2's target and
gives the workspace a single title scale.

**Resolution:** `Heading` defines one rung per role - `display` (hero only), `page` (`--fs-h2`, every
page title: games, roster, collections, collection editor, settings, reports, legal, share),
`section` (`--fs-h3`, legal document sections), `sub` (`--fs-title`, card/form titles such as login,
signup, new game, game review, team share link) and `eyebrow` (`--fs-caption` small caps, the label
over a group or panel, previously split between `--fs-body-sm`/muted/`--ls-caps` on home and
`--fs-caption`/secondary/`--ls-wide` elsewhere).

### G9 - Pitch-green video backdrop (Done / brand)

`README.md` (Backgrounds): _"the video area is a dark radial-green 'pitch' with faint vertical
stripes."_ The video area previously rendered as flat `bg-[var(--surface-inset)]`, so the branded
pitch backdrop (visible in letterboxing and while a chapter loads) was missing.

**Resolution:** the design project's player mockup (`ui_kits/coach-app/TaggingScreen.jsx`) carries the
exact values - a `radial-gradient(ellipse at center, #0e3a24, #07190f 70%)` field under faint
`repeating-linear-gradient` mown stripes at 12% opacity. These are now tokens in
`tokens/colors.css` (`--pitch-core`/`--pitch-edge`/`--pitch-stripe`) composed into a single
`--video-backdrop` background-image, applied via `bg-[image:var(--video-backdrop)]` on both the
player frame and the `<video>` element (so the pitch shows through the letterbox bars, not just
behind the container). Shared across themes - the video frame is a fixed broadcast surface.

### G10 - `--glow-live` reserved but unused (Done / dropped)

`tokens/effects.css` defines `--glow-live` for "live/recording affordances"; it is applied nowhere.
This product tags **already-recorded** games (no live capture), so there may be no live/REC state to
decorate - in which case the token is dead by design, not a gap.

**Recommendation:** confirm with the product owner whether any live/REC affordance is planned. If
not, drop `--glow-live` and its README mention; if so, that lane owns the fix. No code change until
decided.

**Resolution:** the product owner confirmed that no live/REC affordance is planned. `--glow-live` was
dropped from `tokens/effects.css` and from the README depth-and-motion note.

## Screen-by-screen gap list

Each screen lists the cross-cutting findings that hit it plus any screen-specific note. Owning lane
in brackets.

### Home / landing - `app/page.tsx`, `features/home/**` [Home]

- G1 (hero `h1` in body font), G7 (`tracking-widest` eyebrow), G6 (`RecentGamesPeek` empty state).
- Screen note: the signed-out feature cards were a flat 3-up grid of muted text -
  no icon, no `accent` edge, no hover. Given `Card` supports `accent` and `interactive`, this was the
  most "template-default" surface in the app and the clearest quick win for hierarchy.
- Resolution: the landing page was rebuilt around a demo game-timeline hero (`GameTimeline.tsx`, an
  `accent` card whose colour-coded tag markers pop in on load) plus a numbered end-to-end flow
  (`HowItWorks.tsx`) and two audience cards (`AudiencePaths.tsx`, coach vs. player). The flat feature
  trio is retired; the signed-in view gains `QuickActions.tsx`.

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
  G6 (`WatchEmptyState`, `ClipBoard` empty), G10 (player).
- Screen note: this is the densest, most important screen and where the panel inconsistency (G3/G4)
  is most felt - the sidebar reads as a different design language from the list screens. Transport
  chrome and scrubber are solid (real `<button>`s, mono clock, tabular-nums); the gap here is
  surface/elevation consistency, not the controls.
- Resolution (G11): the whole screen was rebuilt as the full-viewport broadcast HUD (left rail, top
  bar, full-bleed video, transport with inline tag buttons, full-width chapter timeline, right tags
  rail + detail) on the layout-rail tokens, so the stacked-`Card` sidebar and its G3/G4/G5 drift no
  longer exist on this screen. See the G11 follow-up entry.

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

## Round 2 - screens shipped since July

The first pass predates the team overview (`/reports`), the game report, collections (coach curation
and the collection share link), settings, the new-game form, and the "Spiel benennen" rename page.
None of them were in scope then, and several re-introduce patterns the G1-G11 fixes retired.

- **Audited:** `develop` at `e7aa389`, 2026-09-23.
- **Method:** the same in-repo contract as round 1, plus a live pass. A dev server ran against the
  local database with a throwaway coach, and every coach and share route was captured at 1280px in
  both themes, with a phone-width check. Mechanical checks found **no** undefined `var(--*)`
  references and no off-token Tailwind colors, radii, shadows or tracking in `src/**`, so the token
  discipline from G2/G7 has held. The gaps below are compositional.

### Round 2 summary

| ID  | Area         | Finding                                                                          | Severity | Owning lane           |
| --- | ------------ | -------------------------------------------------------------------------------- | -------- | --------------------- |
| G12 | Shell        | Coach app bar has no narrow layout - every coach page scrolls sideways on phones | High     | Shell                 |
| G13 | Contrast     | Soft tag chip text fails WCAG AA in the light theme (1.8:1 - 3.4:1)              | High     | Design system         |
| G14 | Shell        | A signed-in coach sees the coach app bar stacked on top of the share shell       | Medium   | Shell                 |
| G15 | Typography   | G1 regression - five new headings bypass `Heading` and render in the body font   | Medium   | Various               |
| G16 | Components   | No shared page header - two back-link styles, two action alignments              | Medium   | Design system         |
| G17 | Empty states | G6 regression - roster, collections list and clip picker empties are bare text   | Medium   | Players / Collections |
| G18 | Layout       | Content width jumps between top-nav sections (2xl / 3xl / 4xl)                   | Low      | Design system         |
| G19 | Composition  | Collection detail: bare editor form, delete button glued to link reset           | Low      | Collections           |
| G20 | Forms        | Share-link field label is sentence case; every other field label is caps         | Low      | Players               |
| G21 | Empty states | `EmptyState` hint wraps to a one-word orphan line                                | Low      | Design system         |

### G12 - The coach app bar has no narrow-viewport layout (High)

`components/shell/AppHeader.tsx:18` lays the brand, the five-item `PrimaryNav` and the account
controls in a single non-wrapping flex row. There is no breakpoint behaviour beyond hiding the
"Angemeldet als" label. In a 500px-wide viewport the header content measures **676px**, so
`document.documentElement.scrollWidth` is 676 and **every coach page scrolls horizontally**. The
brand wraps onto three lines, "Einstellungen" is clipped, and the theme toggle and "Abmelden" sit
off-screen. Coaches review reports and share links on their phones at the pitch, so this is the most
user-visible gap in round 2.

**Recommendation:** give the bar a narrow layout. Either the nav becomes a horizontally scrollable
row under the brand, or it collapses behind a menu button below `sm`. Keep the account controls
reachable without horizontal page scroll. Add a regression test that asserts the header does not
overflow at a phone width.

### G13 - Soft tag chips fail text contrast in the light theme (High)

`components/data/TagChip.tsx:40-60` renders the `soft` variant as the tag hue on a 14% tint of
itself, with the **text in the same hue** (`text-[color:var(--tag-*)]`). The `--tag-*` hues are
shared across themes (`tokens/colors.css:72-81`) and tuned for the dark surfaces. On the light
theme's near-white cards the chip text contrast is: Tor `#f6b93b` **1.76:1**, Aktion gut `#2fd08a`
**2.00:1**, Whistle `#b98bff` 2.56:1, Ecke kurz `#4d8dff` 3.20:1, Aktion schlecht `#f0556a` 3.38:1.
All fail AA (4.5:1) for their micro caps size. They label every report column and stat card, so the
report pages are the most affected.

**Recommendation:** keep the fill hues (they are the tag identity, also used for telestration), but
add a light-theme text step per tag (e.g. `--tag-tor-text`) that clears 4.5:1 on `--surface`, and
point the `soft` variant's text at it. Dark theme values stay as they are. Record the new pairs in
`ux-audit.md` alongside the UX-8 contrast table.

### G14 - Coach chrome renders on the share surfaces for a signed-in coach (Medium)

`components/shell/AppShell.tsx` draws the `AppHeader` whenever a session exists and hides it only
for `isImmersiveRoute` (`immersive-routes.ts`, the watch page). Its doc comment assumes the share
routes have no session, but the coach is the first person to open a share link, to check it before
sending it. They then see the coach bar (with its full nav) stacked above the share shell's own
branded bar and "Privater Link" badge: two brand bars and cross-surface links on a surface the
project rules require to be nav-free. It does not leak anything to players (they have no session),
but the page looks broken and does not preview what players see.

**Recommendation:** hide the coach bar on `/share/**` as well. Generalise the predicate from
"immersive" to "routes that bring their own chrome" and cover both patterns in its test.

### G15 - New headings bypass `Heading` (G1 regression) (Medium)

Five headings on the new screens hand-roll `<h1>`/`<h2>` classes instead of using the `Heading`
primitive. They render in Hanken Grotesk (body) and some at the wrong rung. Side by side, "Spiele"
is Saira and "Sammlungen" is Hanken:

- `app/collections/page.tsx:32` - collections `h1` (`--fs-h2`, body font)
- `app/collections/[id]/page.tsx:58` - collection detail `h1` (body font)
- `app/games/[id]/edit/page.tsx:56` - "Spiel benennen" `h1` at `--fs-title`
- `components/games/GameFormCard.tsx:18` - "Neues Spiel" `h1` at `--fs-title`
- `features/share/team/TeamShareLink.tsx:28` - "Team-Link" `h2` on the roster (body font; the
  settings page's card titles fill the same role with `Heading size="sub"`)

**Recommendation:** swap all five for `Heading` (`page` for the three page titles, `sub` for the two
card titles). To stop the next regression, add an ESLint `no-restricted-syntax` rule that flags raw
`h1`-`h3` JSX outside `components/core/Heading.tsx` (the visually-hidden `ReportFigures` heading and
the `CommentThread` HUD caption can opt out with a disable comment that says why).

### G16 - No shared page header (Medium)

Every page composes its own header row, and they have drifted:

- **Back links:** `features/reports/ReportHeader.tsx:32` uses a chevron icon and a hover colour.
  `app/games/new/page.tsx:25`, `app/games/[id]/edit/page.tsx:48` and
  `app/collections/[id]/page.tsx:51` use plain muted text with no icon, which reads as a stray word
  above the page ("Spiele", "Alle Sammlungen").
- **Action alignment:** `GamesHeader` uses `items-start` (the button lines up with the title),
  `TeamReportHeader`/`ReportHeader` use `items-end` (the button sits level with the subtitle).
- **Form pages** put their title inside the card (G15), so they have no page title at all.

**Recommendation:** a `PageHeader` in the core catalogue (`back?: { href, label }`, `title`,
`subtitle`, `actions`) that owns the chevron back link, the `Heading level={1}` and one action
alignment. Adopt it on games, roster, collections, reports, settings and the two form pages.

### G17 - Bare-text empty states on the new screens (G6 regression) (Medium)

`EmptyState` exists and is used by the share pages and reports, but three newer lists still render a
single muted line in a card:

- `components/players/PlayerRoster.tsx:24` - "Noch keine Spielerinnen oder Spieler angelegt."
- `features/share/collections/CollectionsList.tsx:25` - "Noch keine Sammlungen. Lege die erste an."
- `features/share/collections/CollectionEditor.tsx:69` - the clip picker's "Noch keine fertigen
  Clips vorhanden ..."

**Recommendation:** adopt `EmptyState` (icon + title + hint) in all three. Split each string into a
title and a hint in the lane's `content.ts`.

### G18 - Content width jumps between top-nav sections (Low)

The `<main>` shell is copied into 13 routes with three widths: `max-w-2xl` (settings, new game,
rename), `max-w-3xl` (games, roster, collections) and `max-w-4xl` (both reports). Switching tabs
in the top nav moves the content's left edge between 216px, 280px and 328px at 1280px, which reads as
layout jitter. The share shell already uses a token (`--content-max`), the coach pages do not.

**Recommendation:** a `PageContainer` primitive with named widths backed by layout tokens (e.g.
`form` and `default`), and one width for all five top-nav destinations so the left edge stays put.
Pairs naturally with G16.

### G19 - Collection detail composition (Low)

`features/share/collections/CollectionSettings.tsx` and `CollectionEditor.tsx`: the share-link panel
is a `Card`, but the editor form below it (name, clip picker, save) sits directly on the page
background, so the page has two surface levels for one object. The destructive "Sammlung löschen"
is a solid danger button right next to "Link zurücksetzen", and a single merged hint paragraph
explains both.

**Recommendation:** put the editor in a `Card variant="panel"` and move delete into its own trailing
danger section with its own hint (the settings page's sectioned layout is the model).

### G20 - Share-link field label casing (Low)

`components/players/ShareLinkField.tsx:31` renders its label ("Freigabelink", "Geheimer Link") in
sentence case at `--fs-caption`, as a `<span>`. Every other field label (`Input`, the report range
form, the collection name) uses UPPERCASE `--ls-caps`. The field appears on the roster and on the
collection detail page, right above caps labels.

**Recommendation:** match the `Input` label treatment.

### G21 - `EmptyState` hint orphans (Low)

`components/core/EmptyState.tsx:54` caps the hint at `max-w-[32rem]`. The share pages' "Noch keine
Clips" hint wraps with the single word "hier." on its own line.

**Recommendation:** add `text-pretty` (and `text-balance` on the title) in the primitive. One line,
every empty state inherits it.

### Round 2 follow-up PRs

Order: the two shell fixes and the contrast fix first (they affect every visit), then the
primitives, then per-screen adoption. Tick as merged.

- [ ] **G14** - hide the coach app bar on `/share/**`. [shell]
- [ ] **G12** - narrow-viewport app bar; no horizontal page scroll on phones. [shell]
- [ ] **G13** - light-theme text steps for the soft tag chips. [design system]
- [ ] **G21** - `text-pretty`/`text-balance` in `EmptyState`. [design system]
- [ ] **G16 + G18** - `PageHeader` and `PageContainer` primitives. [design system]
- [ ] **G15** - migrate the five hand-rolled headings to `Heading`, plus the lint guard. [games,
      players, collections; lands with or after G16 so the form pages gain a page title]
- [ ] **G17** - `EmptyState` on roster, collections list and clip picker. [players, collections]
- [ ] **G19 + G20** - collection detail composition and share-link label casing. [collections,
      players]

## Follow-up PRs

Each fix lands as its own scoped PR into `develop`, referencing `P2-8`. Owning lane in brackets.
Land the two typography fixes first (highest payoff, lowest risk), then the surface/elevation work,
then per-screen polish. Tick as merged.

- [x] **G1 + G2 + G8** - add a `Heading` primitive (Saira + `--ls-tight` + heading line-height + a
      single page-title size), replace the six heading sites, retire `--fs-heading`. [design system]
- [x] **G3 + G5** - decide the one panel contract (extend `Card` with a `panel` variant + deliberate
      elevation) and migrate the seven hand-rolled workspace `<section>`s. [design system, then watch /
      tagging / quarters / suggestions / player]
- [x] **G4** - add `SectionHeading`/`PanelHeader` to the catalogue; adopt in the G3 migration.
      [design system]
- [x] **G6** - add an `EmptyState` component; adopt on home, games, watch, clip board. [design
      system, then per screen]
- [x] **G7** - swap `tracking-wide`/`widest` for `--ls-caps` on the home eyebrow and recent heading.
      [home]
- [x] **G9** - implement the pitch-green radial + stripe video backdrop from the design project's
      values. [player]
- [x] **G11** - rebuild the watch/tagging screen as the full-viewport broadcast HUD (left rail, top
      bar, full-bleed video with REC/clock overlays, transport with inline tag buttons, full-width
      chapter timeline, right tags rail + detail) on the layout-rail tokens, replacing the centered
      document column. This supersedes the G3/G4/G5 sidebar-panel gaps on this screen: the stacked
      `Card` panels (`ClipBoard`, `TaggingPanel`/`TagList`, `HotkeyHints`) are retired for the rail
      and transport surfaces. [watch / tagging / player]
- [x] **G10** - confirm whether a live/REC affordance is in scope; keep or drop `--glow-live`
      accordingly. Decided: not in scope, token dropped. [player]

Update this checklist as each PR merges.
