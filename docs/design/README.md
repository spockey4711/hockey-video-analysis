# Design system

The visual language for the coach app: a dark-first, broadcast/HUD-flavoured workspace for
field-hockey video tagging and clip sharing. This doc is the in-repo reference; the canonical
source is the claude.ai design project **"Hockey Video Analysis Design System"** (owner: yannik).
Keep the two in sync - when the design project changes, re-import the token files below and update
this doc in the same PR.

## What lives where

- **Tokens (the contract):** [`src/styles/tokens/`](../../src/styles/tokens/) - `colors.css`,
  `typography.css`, `spacing.css`, `effects.css`, `fonts.css`. Plain CSS custom properties; these
  are production-ready and imported today.
- **Global entry:** [`src/styles/globals.css`](../../src/styles/globals.css) - imports every token
  file plus a minimal token-driven base layer. The app shell (backlog `P0-1`) imports this one file
  in `src/app/layout.tsx`; nothing else should import tokens directly.
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
  raw ramp steps. Fill/ink pairs carry a matching ink alias (`--accent-ink`, `--danger-ink`); the
  video area uses `--surface-inset` with `--scrim` for the buffering overlay, and control thumbs use
  `--knob`. Use `--danger` for danger _text/borders_ on dark surfaces, but `--danger-strong` for
  solid danger _fills_ (e.g. the destructive button) so `--danger-ink` clears AA.
- **Type.** Saira (technical, semi-condensed, athletic) for display headings and UPPERCASE labels;
  Hanken Grotesk for body/UI; JetBrains Mono for all timecodes and numeric HUD readouts. Numbers are
  first-class - timecodes, durations, jersey numbers and tag counts are always mono with tabular
  figures.
- **Spacing & shape.** 4px base grid; dense enough for a timeline/data workspace. Fixed layout rails
  (`--sidebar-w`, `--rail-w`, `--topbar-h`, `--timeline-h`). Control heights 28/34/44px (44px min
  touch on primary CTAs). Crisp small radii (`--radius-xs`..`--radius-xl`, 3-16px); pill radius for
  chips, tracks, and the scrubber knob.
- **Depth & motion.** Deep cool shadows (`--shadow-sm`..`--shadow-pop`). Brand glow (`--glow-turf`
  focus ring, `--glow-live`) is reserved for focus and live/recording affordances, never decoration.
  Motion is quick and functional: `--dur-fast` 120ms hover/focus, `--dur-med` 200ms card lift,
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
`users`, `user`, `play`/`pause`, `rewind`/`fast-forward`, `sparkles` (whistle suggestion), `link`,
`trash-2`, `chevron-left`. Jersey numbers and initials stand in for player avatars. No emoji.

## Component catalogue

Specs the `DS-*` tasks build to. Props are the intended public API; refine against real usage.

### Core

| Component | Purpose                                             | Key props                                                   |
| --------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `Card`    | Surface container for panels, clip tiles, list rows | `interactive` (hover lift), `accent` (brand-green top edge) |
| `Icon`    | Lucide glyph wrapper                                | `name`, `size`, `color`                                     |

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
- **Fonts are Google Fonts substitutes** (Saira, Hanken Grotesk, JetBrains Mono), currently loaded via
  CDN `@import` in `tokens/fonts.css`. When `P0-1` lands the app shell, migrate to `next/font` for
  self-hosting and to drop the render-blocking request; swap in licensed brand fonts here if they
  exist.
- **Brand green is approximate** (`--turf-500: #1eac51`) - the club site's exact hex could not be
  sampled. Adjust in `tokens/colors.css` if the club has an official value.
