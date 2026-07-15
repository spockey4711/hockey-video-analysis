# Code conventions

**Purpose:** how code is written across every project built from this blueprint, so it stays
consistent regardless of who (or what) writes it. The stack-specific rules live in your
variant's conventions overlay; this is the shared baseline enforced by tooling and review.

Related: [git workflow](git-workflow.md) · [quality & testing](quality-and-testing.md)

## Language & tooling

- **Static types on, strict.** Turn strictness to the maximum the language offers and keep it
  there. No escape hatches (`any`, force-unwrap, `# type: ignore`) without a justifying comment.
- **A formatter owns formatting.** Do not hand-format or argue with it. Run on save and in CI.
- **A linter is the gate.** Warnings are not acceptable in CI; fix them or explicitly disable a
  rule with a justification comment.
- **English** for all identifiers, comments and docs. User-facing copy may be localized, but
  never scattered as string literals - keep it in a dedicated content/localization layer.

## Naming

- Descriptive over short. Names carry intent; the next reader should not need the definition.
- Booleans read as predicates: `isVisible`, `hasBooted`, `shouldRetry`.
- Follow the idiomatic casing of the language and match the surrounding code. Do not import
  conventions from another ecosystem.
- No type-name prefixes/suffixes that the type system already makes obvious.

## Structure

- One responsibility per unit; one primary export per file (plus tightly-coupled helpers).
- No business logic buried in the presentation layer - extract it to a testable module.
- Prefer composition over inheritance and over configuration-flag parameters that balloon
  over time.
- Keep public surfaces small and stable; program to interfaces, not implementations.

## Comments

- Comment the **why**, not the **what**. Delete dead code instead of commenting it out (git
  remembers).
- Public functions get a one-line doc comment on intent and units (e.g. timings in ms).

## Errors & resilience

- Handle errors deliberately: fail loudly in development, degrade gracefully in production. No
  swallowed exceptions, no empty catch blocks.
- Return typed "unavailable" states rather than throwing across a boundary the caller renders.
- Validate and sanitize all input at boundaries (OWASP Top 10 mindset, even for small apps).

## Security & data

- Never leak secrets into a client bundle or public config. Least privilege for tokens and env
  vars; rotate immediately on any leak.
- Never trust input; the boundary is where validation happens, not the interior.

## Dependencies

- Add a dependency only when it clearly beats a small amount of local code. Prefer the platform
  standard library over a package.
- Pin versions; review lockfile changes. Record notable additions in the changelog and, if
  architectural, an ADR.

---

## Stack-specific conventions (Next.js / TypeScript / Tailwind)

### Language & tooling

- **TypeScript, `strict: true`.** No `any` unless justified with a comment; prefer `unknown`
  + narrowing. No non-null `!` assertions without a reason.
- **Prettier** owns formatting; **ESLint** (Next config + `jsx-a11y` + import ordering) is the
  lint gate. Zero warnings in CI.
- Target one Node LTS and one pnpm; pin them in `.nvmrc`, `.tool-versions` and the
  `packageManager` field of `package.json` so local, CI and teammates match.

### Naming

- Files: components `PascalCase.tsx`; modules/utilities `kebab-case.ts`; hooks `use-thing.ts`
  exporting `useThing`.
- React components `PascalCase`; props type `ComponentNameProps`. Types/interfaces
  `PascalCase`, no `I`-prefix.

### React / Next

- **Server Components by default.** Add `'use client'` only where interactivity, browser APIs
  or hooks require it - keep client components small and at the leaves.
- Live data never fetched from client components directly - go through `app/api/*` route
  handlers.
- No business logic in JSX - extract to `lib/` and test it.
- Keys are stable ids, never array indices for dynamic lists.

### Styling

- Tailwind utilities + design tokens only. **No raw hex values in components** - always a
  token. Group long class lists logically; consider a `cn()` helper for conditional classes.
- Per-frame animation writes a CSS variable via a ref, not React state.
