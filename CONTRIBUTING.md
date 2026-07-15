# Contributing

This may be a personal project, but it is run like a real one so it stays maintainable for
years. This file is the short version; the full detail lives in
[`docs/engineering/git-workflow.md`](docs/engineering/git-workflow.md).

## Ground rules

- **Language:** code, comments, docs, commits and PRs are in **English**. Localize user-facing copy in a dedicated content layer, never as scattered string literals.
- **Style:** plain and direct. No emojis anywhere in the repo. Use the regular hyphen `-` only.
- **Small steps:** small commits and small PRs beat big ones. One logical change per commit.

## Workflow

Two long-lived branches: feature work integrates on `develop`, and `develop` is
promoted to the always-deployable `master` via a periodic release PR.

1. **Branch** off `develop` into its own worktree: `pnpm wt new <type>/<slug>`.
   Never commit directly to `develop` or `master`; the main clone stays on
   `master` and each feature branch gets its own directory.
   - `feat/login`, `fix/scroll-jitter`, `docs/deployment`, `chore/deps`.
2. **Build the change.** Keep it focused on one thing.
3. **Keep quality green** before pushing:
   ```bash
   sh scripts/check-env.sh && pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
4. **Update the docs and the changelog** in the same PR as the code they describe.
5. **Open a PR into `develop`** and fill in the checklist below.
6. **Merge** with a merge commit once CI is green. The merged feature branch is auto-deleted;
   run `pnpm wt gc` to remove its worktree.
7. **Release** by opening a `develop` -> `master` PR every few days once
   `develop` is worth shipping.

## Commit messages — Conventional Commits

```
<type>(<optional scope>): <short summary in the imperative>

<optional body: what and why, not how>

<optional footer: BREAKING CHANGE:, Refs: #123>
```

Allowed `type`s: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`.

## Pull request checklist

- [ ] Scope is one logical change; title follows Conventional Commits.
- [ ] The quality gate passes locally.
- [ ] Docs updated (including `CHANGELOG.md` under `[Unreleased]`).
- [ ] No emojis, no fancy dashes, English in code/docs.
- [ ] Backlog task ID referenced (e.g. `Refs: P1-3`) if applicable.

## Definition of done

A task is done when it is built, tested, documented, deployed (or deployable) and the changelog
reflects it. See
[`docs/engineering/quality-and-testing.md`](docs/engineering/quality-and-testing.md) for the
quality bar.
