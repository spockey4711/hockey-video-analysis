# Quality and testing

**Purpose:** the quality bar and how it is enforced for this Next.js project. This is the
concrete overlay of the blueprint's [shared quality shape](engineering-standards.md).

## The quality gate (must be green to merge)

Run locally before pushing; CI runs the identical set on every PR:

```bash
pnpm lint         # ESLint (incl. jsx-a11y) - zero warnings
pnpm typecheck    # tsc --noEmit - zero errors
pnpm test         # Vitest unit tests
pnpm build        # production build must succeed
```

CI additionally runs the Playwright smoke suite. Add a Lighthouse budget job if the project has
a performance bar worth enforcing.

## Testing strategy

Test what has logic or can silently break; do not chase coverage on presentational markup.

- **Unit (Vitest + Testing Library):** `lib/` logic (calculations, SEO/metadata builders,
  data adapters and their fallback behavior), and key component behavior (guards,
  reduced-motion branches, parsing).
- **E2E smoke (Playwright), a few only:** home page renders, primary nav works, a critical
  flow succeeds, a live widget renders its fallback when its API route is unavailable.
- **No snapshot tests of large DOM** - they rot and prove little.

Target: meaningful coverage of `lib/` and critical components, not a global percentage.

## Tooling

- **ESLint** - `eslint.config.mjs`: Next presets (`core-web-vitals` + `typescript`, which
  include `jsx-a11y`), an explicit `import/order` rule, and `eslint-config-prettier` last.
  Run: `pnpm lint`.
- **Prettier** - `prettier.config.mjs` with `prettier-plugin-tailwindcss`. Run: `pnpm format`.
- **Vitest + Testing Library** - `vitest.config.ts` (jsdom, `@/*` alias). Specs in
  `tests/unit`. Run: `pnpm test`.
- **Playwright** - `playwright.config.ts` boots the app via its `webServer` block. Specs in
  `tests/e2e`. Run: `pnpm test:e2e`.
- **lint-staged + husky** - a `pre-commit` hook formats and lints only staged files. Husky
  no-ops outside a git repo, so container and CI installs are unaffected.
- **CI** - `.github/workflows/ci.yml` runs the four gates plus the Playwright smoke suite on
  every PR into `develop`/`master`; `.github/dependabot.yml` keeps npm + Actions deps current.

## Security and commit gates

Every PR also runs the security-gate baseline in `.github/workflows/` (shared
across variants), complementing the quality gate above:

- **`security.yml`** - gitleaks secret scanning, semgrep SAST, and (on PRs)
  `dependency-review` against the GitHub Advisory Database.
- **`codeql.yml`** - GitHub CodeQL semantic analysis; findings surface under
  Security > Code scanning.
- **`commit-checks.yml`** - commitlint on every commit plus a Conventional-Commits
  check on the PR title (the squash-merge subject).
- **`coverage.yml`** - reports line coverage and enforces a soft floor read from
  the `COVERAGE_MIN` repository variable (default `0`, i.e. report-only), so the
  threshold is opt-in and never reddens a fresh scaffold.

## Release automation

On every push to `master`, `release.yml` runs
[release-please](https://github.com/googleapis/release-please), turning the
Conventional-Commits history into releases and closing the loop on the changelog
discipline above:

- It maintains a standing **release PR** whose diff is the next SemVer bump plus
  the generated `CHANGELOG.md` entries (`feat` -> minor, `fix`/`perf` -> patch,
  `BREAKING CHANGE` -> major). Merging that PR tags the release and publishes a
  GitHub Release.
- `release-please-config.json` pins the release strategy to `node`, so it also bumps
  the `version` field in `package.json` in the release PR.
- This automates the manual "move `[Unreleased]`, tag, publish" steps in the git
  workflow: let the merged commits drive `CHANGELOG.md` instead of hand-editing it.

## Provider-agnostic CI (GitLab)

The kit is not GitHub-only. Each project also ships a `.gitlab-ci.yml` that mirrors
the same gates, so it can live on either forge:

- **`quality`** stage - runs the quality gate above.
- **`security`** stage - GitLab's managed SAST, secret detection and dependency
  scanning, the GitLab-native counterpart to the GitHub security gate.
- **`deploy`** stage - the `deploy:preview` job (below).

`workflow:` rules run the pipeline on merge requests and the protected branches
without spawning duplicate pipelines. Delete `.gitlab-ci.yml` if the project is
hosted on GitHub only.

## Preview deploy

A provider-neutral preview environment ships for both forges - `preview-deploy.yml`
on GitHub and the `deploy:preview` job on GitLab. On every PR/MR it stands up an
ephemeral environment and comments its URL, then tears it down when the PR/MR
closes. The plumbing is wired; only the deploy step is a TODO, so point it at your
host (Vercel, Netlify, GitHub/GitLab Pages, Fly, ...).

## Definition of done

1. It works and matches the design/motion/a11y specs.
2. lint, typecheck, test, build are green.
3. Docs are updated and `CHANGELOG.md` has an entry.
4. It is merged via a reviewed PR and is deployable (or deployed).
