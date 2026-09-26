# Design system

The visual language for the coach app: a dark-first, broadcast/HUD-flavoured workspace for
field-hockey video tagging and clip sharing. This doc is the in-repo reference; the canonical
source is the claude.ai design project **"Hockey Video Analysis Design System"** (owner: yannik).
Keep the two in sync - when the design project changes, re-import the token files below and update
this doc in the same PR.

Related audits: [`ux-audit.md`](ux-audit.md) (UX-8: token drift, WCAG contrast/focus) and
[`design-gap-audit.md`](design-gap-audit.md) (P2-8: visual-quality gap to the reference - typography
hierarchy, surface/elevation consistency, component polish).

## What lives where

- **Tokens (the contract):** [`src/styles/tokens/`](../../src/styles/tokens/) - `colors.css`,
  `typography.css`, `spacing.css`, `effects.css`. Plain CSS custom properties; these are
  production-ready and imported today.
- **Web fonts:** [`src/styles/fonts.ts`](../../src/styles/fonts.ts) - self-hosted with `next/font`:
  the files are fetched once at build time and served from the app's own origin, so visitors never
  contact Google. The root layout puts the generated font variables on `<html>`, and
  `typography.css` builds `--font-display` / `--font-sans` / `--font-mono` on top of them.
- **Global entry:** [`src/styles/globals.css`](../../src/styles/globals.css) - imports every token
  file plus a minimal token-driven base layer. The app shell (backlog `P0-1`) imports this one file
  in `src/app/layout.tsx`; nothing else should import tokens directly.
- **Themes (dark + light):** the palette is fixed but the **semantic aliases** are themed. `:root`
  carries the dark theme (the default, dark-first); `:root[data-theme="light"]` in `colors.css`
  restates the same aliases onto a light `--paper-*` neutral scale (a cool-slate mirror of `--ink-*`,
  so the brand hue carries across). Shadows compose from per-theme knobs (`--shadow-rgb`,
  `--shadow-strength`) so light gets soft slate elevation. Because components only ever touch the
  aliases, they inherit both themes with no per-component work. The coach `ThemeToggle`
  ([`src/components/shell/`](../../src/components/shell/)) sets `data-theme` on `<html>` and persists
  the choice to `localStorage`; a blocking `ThemeScript` (first in `<body>`) applies the stored choice
  (or the OS `prefers-color-scheme`) before first paint. Never hard-code a theme's color in a component.
- **Component specs:** the catalogue below. Production React/TS/Tailwind components are built from
  these specs by the `DS-*` backlog tasks - the design project's `.jsx` files are inline-styled
  prototypes, not the components we ship.

## Brand foundations

- **Color.** Brand **pitch green** (`--turf-*`, primary `#1eac51`, Duennwalder TV club green) for
  primary actions, focus, live/REC state, and the video backdrop. **Cool slate** neutrals
  (`--ink-*`) build the dark workspace. A **semantic tag palette** codes the product's core objects:
  `--tag-tor` gold, `--tag-ecke` blue, `--tag-gut` green, `--tag-schlecht` red, `--tag-whistle`
  violet (AI suggestion). Clip-pipeline statuses map to pending/processing/ready/failed. **Always
  reference the semantic aliases** (`--accent`, `--surface`, `--text-primary`, `--border`, ...), not
  raw ramp steps. Fill/ink pairs carry a matching ink alias (`--accent-ink`, `--danger-ink`,
  `--tag-*-ink`). Tag-colored _text_ (the soft `TagChip`) uses the per-theme `--tag-*-text` alias,
  never the `--tag-*` fill: the fills are tuned for dark surfaces, so the light theme maps the alias
  to a deeper step of the same hue (`--tag-*-deep`; two dark-theme hues use a lifted `--tag-*-lift`)
  that clears AA on every surface, and a unit test
  (`tests/unit/components/tag-chip-contrast.test.tsx`) holds every chip pair at 4.5:1 or better. The
  video area uses the `--video-backdrop` pitch (radial turf + faint mown stripes); chrome laid
  directly on the video (the game clock, paused and buffering states) uses the
  theme-independent broadcast pair `--video-scrim` + `--video-ink` (a strong dark scrim and light
  ink) so it reads over a bright pitch - not `--scrim`/`--text-inverse`, which flip per theme. A whole
  toolbar on the video (telestration) sits on the denser `--video-panel`, its icon controls use
  `--video-control-hover`/`--video-control-active`, and the drawing pens are `--draw-red`,
  `--draw-yellow`, `--draw-blue`, `--draw-white` with a `--draw-halo` edge under each stroke. Control
  thumbs use `--knob`. Use `--danger` for danger _text/borders_ on dark surfaces, but `--danger-strong` for
  solid danger _fills_ (e.g. the destructive button) so `--danger-ink` clears AA.
- **Type.** Saira (technical, semi-condensed, athletic) for display headings and UPPERCASE labels;
  Hanken Grotesk for body/UI; JetBrains Mono for all timecodes and numeric HUD readouts. Numbers are
  first-class - timecodes, durations, jersey numbers and tag counts are always mono with tabular
  figures. Every heading goes through the `Heading` primitive, which carries the display face, the
  heading line-height and one type-scale rung per role: `display` (`--fs-display`, the marketing hero
  only), `page` (`--fs-h2`, every page title), `section` (`--fs-h3`, a section in a page's content
  column), `sub` (`--fs-title`, card, form and row titles) and `eyebrow` (`--fs-caption` small caps
  with `--ls-caps`, the label over a group or panel). Letter-spacing and line-height always come from
  the `--ls-*`/`--lh-*` tokens, never Tailwind's built-in `tracking-*`/`leading-*` steps; a unit test
  (`tests/unit/components/design-token-refs.test.ts`) fails on any reference to an undeclared
  `--fs-*`/`--lh-*`/`--ls-*`/`--fw-*`/`--space-*` token.
- **Spacing & shape.** 4px base grid; dense enough for a timeline/data workspace. Fixed layout rails
  (`--sidebar-w`, `--rail-w`, `--topbar-h`, `--timeline-h`). Coach pages sit in a `PageContainer` at
  one of two content widths (`--page-max` for every top-nav section, `--page-max-form` for a
  single-form page), so switching sections never moves the left edge, and open with a `PageHeader`.
  Control heights 28/34/44px (44px min touch on primary CTAs). Crisp small radii
  (`--radius-xs`..`--radius-xl`, 3-16px); pill radius for chips, tracks, and the scrubber knob.
- **Surfaces & depth.** Every panel is a `Card`: one radius (`--radius-lg`), one hairline
  (`--border-subtle`), one surface (`--surface`), whether it frames a list row, a form, a settings
  section, a report table or a share state; never hand-roll a bordered `<div>`/`<section>` as a
  panel (inset wells such as alerts, empty lists and code fields stay `--surface-inset`). A panel's
  title and hint go through `PanelHeader`. Deep cool shadows form one deliberate ramp: `--shadow-sm` for resting
  cards (and the skeletons that stand in for them), `--shadow-md` for the hover lift of an
  `interactive` card, `--shadow-lg` for a floating layer anchored to a trigger (an `overlay` card:
  popovers, disclosure panels) and `--shadow-pop` for a modal dialog over the page. Brand glow
  (`--glow-turf` focus ring) is reserved for focus, never decoration.
- **Empty states.** Anything with nothing to show yet - an empty list, a panel with no data, a slot
  waiting for a selection, a share link with no clips, a missing page - renders `EmptyState`: a glyph
  naming what is missing, a short title without a full stop, and an optional one-line hint and primary
  action. Pick the `size` by the room it fills: `sm` for a slot inside a panel, `md` for a whole card,
  `lg` for a page-level state; an empty slot inside a panel also takes `inset`, the `--surface-inset`
  well. A single value or meta line that is simply absent (a "-" cell, "Keine Kapitel") stays inline
  text. Never hand-roll a centered line of muted text.
- **Motion.** Quick and functional: `--dur-fast` 120ms hover/focus, `--dur-med` 200ms card lift,
  `--ease-out` for most transitions. No bounces or infinite decorative loops.
- **Backgrounds.** Flat slate surfaces; the video area is a dark radial-green "pitch" with faint
  vertical stripes. No photographic hero imagery; gradients only for the scrubber fill and the pitch
  backdrop.

## Content & copy rules

- **UI copy is German; code, tokens and docs are English.** Keep user-facing strings in a content
  layer, never scattered literals (mirrors `CLAUDE.md`).
- **Tone:** terse, functional, coach-to-coach. Labels are nouns or short verb phrases ("Clips
  schneiden", "Spieler zuordnen", "Sichtbarkeit: Team-weit"). No marketing voice.
- **Casing:** nav labels and tag chips are UPPERCASE with wide tracking (HUD feel); sentence case for
  body and helper text.
- **Domain vocabulary:** Tor, Ecke kurz, Aktion gut, Aktion schlecht (tag types); Viertel (quarter);
  Team-weit vs. Einzeln (visibility); Vorschlaege (AI whistle suggestions); geheimer Link (secret
  share link).
- **No emoji, no fancy dashes** - regular hyphen only. Unicode allowed only for functional
  separators (`.`, `/`).

## Iconography

**Lucide** (https://lucide.dev) - clean, consistent stroke icons. This is a documented substitution;
the source scaffold shipped no icon set. Common glyphs: `film`, `scissors`, `tag`, `flag`, `share-2`,
`users`, `user`, `play`/`pause`, `rotate-ccw` (replay), `rewind`/`fast-forward`, `sparkles` (whistle suggestion), `link`,
`trash-2`, `chevron-left`, `chart-column` (game report), `pen-tool` (draw on a still) with its
tools `pencil`, `arrow-up-right`, `circle` and `undo-2`, `mouse-pointer-2` (presentation laser pointer), `sticky-note` (presenter notes). Jersey numbers and initials stand in for player avatars. No emoji.

## Component catalogue

Specs the `DS-*` tasks build to. Props are the intended public API; refine against real usage.

### Core

| Component       | Purpose                                            | Key props                                                                                                                       |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Card`          | The one surface for panels, clip tiles, list rows  | `as` (`div`/`section`), `interactive` (hover lift), `overlay` (floating `--shadow-lg` layer), `accent` (brand-green top edge)   |
| `EmptyState`    | The one empty/placeholder state                    | `icon`, `title`, `hint`, `action` (primary action), `size` (sm/md/lg), `tone` (neutral/warning), `inset` (well inside a panel)  |
| `Heading`       | Every page/section/card heading, in the Saira face | `level` (1-6, document outline), `size` (display/page/section/sub/eyebrow)                                                      |
| `Icon`          | Lucide glyph wrapper                               | `name`, `size`, `color`                                                                                                         |
| `PageContainer` | The `<main>` content column of a coach page        | `width` (`default`: `--page-max`, every top-nav section; `form`: `--page-max-form`, single-form pages)                          |
| `PageHeader`    | The one header for a coach page                    | `title` (the page's `h1`), `subtitle`, `back` (`{ href, label }`, chevron back link), `actions` (bottom-aligned, wrap on phone) |
| `PanelHeader`   | The one header for every panel and card            | `title`, `hint`, `action` (trailing controls/meta), `size` (eyebrow/sub), `level`, `titleId`                                    |

### Data

| Component     | Purpose                                                                   | Key props                                                                                           |
| ------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `TagChip`     | Coded chip for a tag type                                                 | `type` (P1-3 key: goal/corner_short/action_good/action_bad, or `whistle`), `label`, `size`, `solid` |
| `StatusBadge` | Clip-pipeline status pill (`processing` pulses)                           | `status` (pending/processing/ready/failed), `label`                                                 |
| `Timecode`    | Mono, tabular game-time readout; auto H:MM:SS / M:SS                      | `seconds`, `frac` (accent hundredths), `size`, `muted`                                              |
| `PlayerChip`  | Player token: initials avatar + optional name/number, deterministic color | `name`, `number`, `size`, `showName`                                                                |
| `Kbd`         | Keyboard key cap for documenting hotkey tagging                           | `size`                                                                                              |

### Forms

| Component    | Purpose                                              | Key props                                                                                                 |
| ------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Button`     | Primary action control                               | `variant` (primary/secondary/ghost/danger), `size` (sm/md/lg), `iconLeft`/`iconRight`, `full`, `disabled` |
| `IconButton` | Square icon-only control (video transport, toolbar)  | `label` (required, aria + tooltip), `variant` (ghost/solid/accent), `active`                              |
| `Input`      | Text field with label, leading icon, hint/error line | `label`, `leading`, `error`, `hint`                                                                       |
| `Select`     | Styled native `<select>`                             | `label`, `options` (string[] or {value,label}[])                                                          |
| `Switch`     | Binary on/off toggle (controlled)                    | `checked`, `onChange(next)`, `label`                                                                      |

## Provenance & open items

The design system was designed fresh from this repo's PRD and architecture docs (the scaffold shipped
no UI, tokens, fonts, or logo). Carry these caveats forward:

- **No brand logo/wordmark.** Rendered as plain type (an "H" monogram block + "HOCKEY VIDEO"
  wordmark). Replace with a real logo when the club provides one.
- **Fonts are open-source substitutes** (Saira, Hanken Grotesk, JetBrains Mono, all SIL Open Font
  License 1.1), self-hosted via `next/font` in `src/styles/fonts.ts`. Swap in licensed brand fonts
  there if they exist.
- **Brand green is approximate** (`--turf-500: #1eac51`) - the club site's exact hex could not be
  sampled. Adjust in `tokens/colors.css` if the club has an official value.
