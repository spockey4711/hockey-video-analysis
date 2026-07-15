# UX design QA - token & accessibility audit

Cross-cutting audit for backlog `UX-8`. It sweeps the shipped app for raw colors and token
drift, and checks focus, hover, contrast, and keyboard navigation against WCAG 2.1 AA and the
design system (`docs/design/README.md`).

This file is the record of findings. Per `UX-8` the fixes land as **small, scoped PRs in the
owning lane** (see [Follow-up PRs](#follow-up-prs)); this document is the single source that
tracks them. Check items off here as the fix PRs merge.

- **Audited:** `develop` @ `6ea9840`, 2026-07-15.
- **Method:** static sweep of `src/**` for raw hex, Tailwind named-palette utilities, and
  ramp-step references; manual review of every interactive component for focus/hover/keyboard
  behaviour; WCAG contrast ratios computed for each text/surface and ink/fill pair in the token
  set. No `--fs-*` step is large-text scale (max body is `--fs-body` 15px, `--fs-title` 18px),
  so every text pair below is judged against the 4.5:1 normal-text threshold, not 3:1.

## Summary

| ID  | Area          | Finding                                                            | Severity | Owning lane   |
| --- | ------------- | ------------------------------------------------------------------ | -------- | ------------- |
| T1  | Tokens        | Two token syntaxes coexist; `@theme` color map is mostly dead code | Medium   | Design system |
| T2  | Tokens        | Raw ramp-step refs (`--ink-*`, `--turf-*`) instead of aliases      | Medium   | Various       |
| T3  | Tokens        | Missing semantic aliases (`--danger-ink`, video-backdrop, knob)    | Low      | Design system |
| A1  | Accessibility | `--text-muted` fails AA (4.1/3.8/3.5:1) for normal-size text       | High     | Design system |
| A2  | Accessibility | Danger button label fails AA (white on `--danger` = 3.22:1)        | High     | Design system |
| A3  | Accessibility | Focus ring is box-shadow only; invisible in forced-colors mode     | Medium   | Design system |
| A4  | Accessibility | Focus ring on card-links is rectangular around a rounded card      | Low      | Games / Home  |
| A5  | Accessibility | `interactive` Card is not focusable on its own (advisory)          | Info     | Design system |

The good news up front: **there is no raw hex and there are no Tailwind named-palette utilities
(`bg-gray-*`, `text-white`, ...) anywhere in `src/**`.** The tag/status palette is well judged -
every chip ink-on-fill pair clears AA comfortably (5.08:1 to 7.88:1). The findings below are token
drift and a small number of genuine contrast/focus gaps, not a raw-color problem. The backlog's
example ("the current homepage `text-accent`/`bg-surface`") is stale: `src/app/page.tsx` already
uses the `[color:var(--accent)]` form.

## Token findings

### T1 - Two token syntaxes coexist; the `@theme` color map is mostly dead

`src/styles/globals.css` maps semantic tokens onto Tailwind utilities via `@theme inline`
(`--color-surface`, `--color-accent`, ...) and its comment states components reference tokens
"through their Tailwind utility (e.g. `bg-surface`, `text-accent`)". In practice:

- The mapped **color** utilities are used in exactly two places - `src/app/layout.tsx:16` and
  `src/features/share/shell/ShareShell.tsx:28`, both `bg-background text-foreground`. The
  `--color-surface`, `--color-border`, `--color-muted`, `--color-accent`, and
  `--color-accent-foreground` mappings are **never used**.
- Every other color reference in the app (100+ sites) uses the arbitrary-value form,
  `bg-[var(--surface)]`, `text-[color:var(--text-muted)]`, etc.

So the documented convention and the shipped convention disagree, and most of the `@theme` map is
dead code. The arbitrary-value form is also the only one that can reach the full token set (the
map covers 7 of ~30 semantic aliases; `--surface-raised`, `--text-secondary`, `--tag-*`, etc. have
no utility).

**Recommendation - standardize on the arbitrary-value `[var(--...)]` form** (the dominant, fuller-
coverage convention): convert the two `bg-background text-foreground` stragglers, drop the unused
`--color-*` mappings from `@theme` (keep only what stays used, e.g. `--font-sans`), and correct the
globals.css comment. This is a small, low-risk change and avoids rewriting 100+ call sites plus
expanding `@theme` to ~30 tokens, which the alternative (bare utilities everywhere) would require.

### T2 - Raw ramp-step references instead of semantic aliases

`README.md` says: "Always reference the semantic aliases (`--accent`, `--surface`, ...), not raw
ramp steps." These sites reach past the aliases into the raw `--ink-*` / `--turf-*` ramp:

- `src/features/player/ContinuousPlayer.tsx:64,71,78` - `bg-[var(--ink-950)]` (x3) for the video
  backdrop. Use `--surface-inset` (its alias). Note line 78 also writes `bg-[var(--ink-950)]/40`;
  the Tailwind opacity modifier is unreliable on a bare `var()` it cannot prove is a color - verify
  the 40% actually applies, and prefer an explicit `color-mix` / dedicated scrim token.
- `src/components/forms/Button.tsx:31` - danger variant `text-[color:var(--ink-000)]`. No
  text-on-danger alias exists (see T3).
- `src/components/forms/Switch.tsx:49` - knob `bg-[var(--ink-000)]` (see T3).
- `src/components/data/player-identity.ts:15` - `bg-[var(--turf-500)] text-[color:var(--ink-950)]`
  in the avatar palette. Use `--accent` / `--accent-ink`.

**Recommendation:** replace each with its semantic alias; add the two missing aliases in T3.

### T3 - Missing semantic aliases

The ramp-step leaks in T2 exist partly because no alias covers the case:

- **`--danger-ink`** - text color on a `--danger` fill. Today the danger button hard-codes
  `--ink-000`; and that pairing fails contrast (see A2).
- **Video-backdrop / scrim** - the player backdrop wants a named alias rather than `--ink-950`
  (`--surface-inset` fits; a `--scrim` for the 40% buffering overlay would be cleaner).
- **Knob / thumb surface** - the Switch thumb wants an alias (`--knob`) rather than `--ink-000`.

**Recommendation:** add these to `tokens/colors.css` and document them in `README.md`; fold into the
same design-system PR as T2.

## Accessibility findings

Contrast ratios were computed for every text/surface and ink/fill pairing in the token set. All
tag chips, status dots, primary-button text, brand/accent text, and body/secondary/primary text
pass AA. Two pairings fail; two focus issues follow.

### A1 - `--text-muted` fails AA for normal-size text (High)

`--text-muted` = `--ink-400` = `#6b7a8c`:

| Background                   | Ratio | AA (4.5:1 normal) |
| ---------------------------- | ----- | ----------------- |
| `--surface` `#12171f`        | 4.10  | FAIL              |
| `--surface-raised` `#171e28` | 3.82  | FAIL              |
| `--surface-hover` `#1d2632`  | 3.48  | FAIL              |

It clears only the 3:1 large-text bar, but it is used for normal-size (`--fs-body-sm` 13px /
`--fs-caption` 12px) helper, meta, hint, and footer text in ~37 sites - feature descriptions
(`src/app/page.tsx:71`), game-card meta (`GameCard.tsx:36,48`), form hints, the share footer
(`ShareShell.tsx:60`), empty states (`WatchEmptyState.tsx:12`), and more. This is the highest-
impact finding.

**Recommendation:** nudge `--ink-400` lighter so muted text clears 4.5:1 on the common panel
surfaces. `#7b8a9c` gives 5.10 / 4.76 / 4.33 (passes on `--surface` and `--surface-raised`;
`--surface-hover` rarely carries muted text). `#8593a4` gives 5.74 / 5.35 / 4.88 for full margin.
Exact value is tunable against the ramp; keep the change to the one token so all 37 sites benefit.

### A2 - Danger button label fails AA (High)

`src/components/forms/Button.tsx:31`: white `--ink-000` `#f7fafc` on `--danger` `#f0556a` = **3.22:1**.
The label is `--fs-body` (15px) semibold - normal text, so it needs 4.5:1. `--danger` is fine as a
**text** color on dark surfaces (5.79:1 for form errors) - the failure is specifically white-on-red
as a **fill**.

**Recommendation:** darken the danger fill for solid buttons (introduce a `--danger-strong` for
fills, keeping `--danger` for text/borders), or pair the fill with a darker `--danger-ink`. Verify
the chosen pair against 4.5:1 before landing.

### A3 - Focus ring is box-shadow-only; invisible in forced-colors mode (Medium)

`globals.css:67` sets `:focus-visible { outline: none; box-shadow: var(--glow-turf); }` and every
control repeats `focus-visible:shadow-[var(--glow-turf)] focus-visible:outline-none`. `box-shadow`
is dropped by Windows High Contrast / `forced-colors: active`, so keyboard focus becomes
**completely invisible** for those users.

**Recommendation:** keep the glow for normal mode but restore a real outline as the forced-colors
fallback, e.g. globally `:focus-visible { outline: 2px solid transparent; outline-offset: 2px; }`
alongside the box-shadow (the transparent outline is repainted as a system color under
forced-colors). This is a single change in `globals.css`.

### A4 - Focus ring is rectangular around rounded card-links (Low)

`GameCard.tsx:26` and `RecentGamesPeek.tsx:45` wrap a rounded `Card` in `<Link className="block">`.
The focus-visible box-shadow paints on the anchor, which has no `border-radius`, so the keyboard
focus ring is a rectangle around a `--radius-lg` card.

**Recommendation:** give the link the card's radius (or move the focus target onto the card). Minor
polish; bundle with whichever lane touches these cards next. (Aside: `RecentGamesPeek` rows are
links but omit `interactive`, so they lack the hover-lift the `GameCard` rows have - align them.)

### A5 - `interactive` Card is not focusable on its own (Info / advisory)

`Card` is a presentational `<div>`; `interactive` only adds hover affordances (cursor, lift), not
focusability or a role. Today the sole `interactive` use (`GameCard`) is correctly wrapped in a
`Link`, so there is no live defect. Recording it so it stays that way: an `interactive` Card must
always sit inside a real `<a>`/`<button>`, never stand alone as a click target. Consider a doc note
on the `interactive` prop.

## What's already good

- No raw hex and no Tailwind named-palette color utilities anywhere in `src/**`.
- Consistent focus handling via `:focus-visible` + per-control glow (A3 is the one gap).
- `IconButton` requires an `aria-label` and sets `aria-pressed`; transport controls are real
  `<button>`s. `Input`/`Select` use real labels. Keyboard operability of controls is sound.
- The tag, status, and accent palettes clear AA (5.08:1-7.88:1 ink-on-fill; 6.60:1 primary button).
- Body/secondary/primary text and brand/accent text all clear AA on every surface.

## Follow-up PRs

Each fix lands as its own scoped PR into `develop`, referencing `UX-8`. Owning lane in brackets.
Tick as merged:

- [ ] **A1** - lighten `--ink-400` to restore AA for muted text. [design system]
- [ ] **A2 + T3** - add `--danger-ink` / `--danger-strong`, fix danger button contrast. [design system]
- [ ] **A3** - forced-colors focus-outline fallback in `globals.css`. [design system]
- [ ] **T1** - converge on `[var(--...)]`, trim dead `@theme` color map, fix comment. [design system]
- [ ] **T2** - swap raw ramp-step refs for aliases in player / Switch / player-identity. [player, design system]
- [ ] **A4** - round the card-link focus ring; align `RecentGamesPeek` `interactive`. [games / home]
- [ ] **A5** - doc note on the `Card` `interactive` prop. [design system]

Update this checklist and `CHANGELOG.md` as each PR merges.
