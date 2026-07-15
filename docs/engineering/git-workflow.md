# Git workflow

**Purpose:** the full branching, commit, PR and release process - the part of the blueprint
that is identical for every project, regardless of language or stack. This is the reference;
the short version lives in [`CONTRIBUTING.md`](CONTRIBUTING.md).

This document is tech-agnostic. Wherever it says "the quality gate", run the concrete commands
your project's `docs/engineering/quality-and-testing.md` defines (they come from the variant
you scaffolded with).

Related: [quality & testing](quality-and-testing.md) · [conventions](conventions.md)

## Task lifecycle

The canonical end-to-end flow for picking up a task. Feature work integrates on `develop`;
the main clone stays on `master`, so its working tree is always clean and ready for the next
task.

Trigger: a request like "do task P0-3 from the backlog".

1. **Create the task's worktree.** `wt new <type>/<short-slug>` (e.g. `wt new feat/login`).
   This branches off `origin/develop` into its own directory and prints the path; do all the
   work there. The main clone stays on `master` - never `git checkout` a feature branch in it.
   See [Worktrees](#worktrees).
2. **Do the work in small commits.** One logical change per commit, Conventional Commits,
   each commit building green. See [Commits](#commits--conventional-commits).
3. **Keep docs and changelog in sync** in the same branch - update the affected docs and add
   an `[Unreleased]` entry to `CHANGELOG.md`.
4. **Run the quality gate** before pushing (the commands from your variant's
   quality-and-testing doc).
5. **Push** the branch to `origin`.
6. **Open a PR into `develop`** describing what changed and why, referencing the task
   (`Refs: P0-3`). Tick the task's box in `docs/project/backlog.md` in the same PR - as soon as
   the work is done and only the merge remains, mark it `- [x]` (do not wait for the merge). See
   [Pull requests](#pull-requests). Never self-merge.
7. **Hand the PR off for review and merge into `develop`.** The main clone never moved, so
   there is nothing to switch back. Once the PR is merged, `wt gc` removes the now-merged
   worktree and its branch.

Backlog markers: `- [ ]` not started, `- [x]` done, `- [~]` merged but a follow-up step still
remains. A task is never left `- [ ]` once its PR has merged - use `- [~]` only when something
still has to happen after the merge, otherwise `- [x]`.

Promoting the accumulated work from `develop` to `master` is a separate, periodic step - see
[Releases](#releases-promoting-develop-to-master).

## Branching model

Two long-lived branches with short-lived feature branches integrating on `develop`:

- **`master`** is the stable release branch, always deployable. It is protected: no direct
  pushes, PRs only, CI must pass. It moves only via the periodic release PR from `develop`,
  never by merging feature branches directly.
- **`develop`** is the integration branch. Feature branches merge here first. If you have a
  dev/staging environment, wire it to auto-deploy from `develop` so a change can be tested
  before it is promoted. It is protected too: PRs only, CI must pass. Because it is protected,
  GitHub's "automatically delete head branches" setting leaves it alone while still cleaning up
  merged feature branches.
- **Feature branches** off `develop`, named `<type>/<short-slug>`:
  - `feat/login`, `fix/scroll-jitter`, `docs/deployment`, `chore/deps`,
    `refactor/user-service`, `perf/query-cache`.
- Keep branches small and short-lived; rebase on `develop` if they fall behind. Delete after
  merge.
- **One directory per branch.** The main clone stays permanently on `master`; every feature
  branch lives in its own worktree branched off `develop`. Never `git checkout` a feature
  branch in the main clone. See [Worktrees](#worktrees).

### Enforcing the protection

The rules above ("protected", "PRs only") describe intent; a host enforces them. Run
`scripts/protect-branches.sh` to apply GitHub branch protection to the long-lived branches
via `gh api`: it requires PRs and approving reviews and blocks direct pushes, force-pushes and
branch deletion. It reads the branch names from `scripts/wt.conf`, so it protects the right
branches for both the two-branch and single-branch layouts. When a `CODEOWNERS` file is present
(scaffold it with `--community`, then replace the `@OWNER` placeholder), it also requires
code-owner review. The script is opt-in and idempotent - re-run it after changing reviewers or
branches. See `scripts/protect-branches.sh --help` for the options (`--reviews`, `--admins`,
`--dry-run`).

### Solo / lightweight variant

For a small solo project the two-branch model can feel heavy. Two acceptable simplifications,
in order of preference:

1. **Keep both branches but skip the dev deploy.** You still get an integration branch and a
   protected release branch; you just do not auto-deploy `develop`.
2. **Single-branch trunk.** Work off `master` only, still in worktrees, still via PRs. Set
   `BASE_BRANCH=master` in `scripts/wt.conf`. Lose the staged-release safety net, keep the
   worktree isolation and the PR gate.

Do not drop PRs or the quality gate - those are the parts that keep the tree healthy.

## Worktrees

Every task runs in its own [git worktree](https://git-scm.com/docs/git-worktree) so that
several sessions (e.g. two parallel AI-assistant chats) can work at once without one changing
the branch under another. The invariant is simple and exception-free:

> The main clone stays on `master`. Each feature branch gets its own directory, branched off
> `develop`.

Worktrees live outside the repo, grouped and hidden, at
`<parent-of-repo>/.worktrees/<repo-name>/<branch-with-slashes-as-dashes>` (e.g.
`~/Projects/.worktrees/myapp/fix-scroll-jitter`), so they never clutter the project list.
Manage them with `scripts/wt.sh` (wire it up as a `wt` alias or a package script):

- **`wt new <type>/<slug>`** - branch off `origin/develop` into a new worktree, link the
  gitignored env files from the main clone, and run the variant's post-create hook (e.g.
  `pnpm install`, `uv sync`, or nothing). Prints the path to `cd` into.
- **`wt ls`** - list all worktrees, each annotated `merged` / `unmerged` / `dirty` (measured
  against `origin/develop`).
- **`wt gc`** - remove every worktree whose branch is already merged into `origin/develop`
  (deletes the folder and the branch). Worktrees with uncommitted or unmerged work are kept
  and reported. Run it after your PRs merge.
- **`wt rm <branch|folder>`** - remove one worktree explicitly (`--force` for a dirty one).

**Parallel work example.** Chat A: `wt new fix/a`, work in the printed directory. Chat B:
`wt new chore/b`, work in its own directory. Neither touches the other's branch and the main
clone never leaves `master`, so nothing collides. After both PRs merge, `wt gc` cleans up.

**No archiving.** A worktree folder is a disposable checkout - once commits are pushed and
merged, the code lives permanently in git history. "Can I delete this folder?" has a
deterministic answer: if `wt gc` removes it, yes; if it keeps it, you still have unmerged or
uncommitted work there.

Configure branch names, allowed types and the post-create install step in
[`scripts/wt.conf`](../scripts/wt.conf.example) (each variant ships one).

## Commits — Conventional Commits

```
<type>(<optional scope>): <imperative summary, lower case, no trailing period>

<optional body: what and why>

<optional footer: BREAKING CHANGE: ... / Refs: P1-3 / Closes #12>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
`revert`. Scopes are project-specific (e.g. `auth`, `api`, `nav`, `deps`).

Rules:
- One logical change per commit; it should build.
- Reference the backlog task in the footer where relevant (`Refs: P1-3`).
- `BREAKING CHANGE:` in the footer bumps the major on release.

Examples:
```
feat(auth): add session guard to protected routes
fix(api): return typed unavailable state instead of throwing
docs(adr): add ADR-0002 for hosting choice
chore(deps): bump the http client to latest
```

## Pull requests

- Feature PRs target **`develop`**; the release PR targets **`master`**.
- Title follows Conventional Commits (the merge commit uses it as the merge message).
- Description: what changed and why, screenshots/recording for visual changes, and the task id.
- The PR checklist (from `CONTRIBUTING.md`) must be satisfied: quality gate green, docs +
  changelog updated, no emojis/fancy dashes.
- **Merge commit** - preserves full branch history and all commits.
- Enable "automatically delete head branches" so a merged feature branch is removed
  automatically. Protect `develop` and `master` so the release PR never deletes them. Locally,
  `wt gc` removes the matching worktree once its branch merged into `origin/develop`.

## Releases: promoting develop to master

`develop` accumulates merged feature work. Every few days, once `develop` is worth shipping,
promote it to `master`:

1. Open a PR from `develop` into `master`. CI runs the full gate again on the merge result.
2. Review the aggregated diff as a release: this is the last gate before `master`, which must
   stay always deployable.
3. **Merge commit** into `master`. `master` is protected and not auto-deleted; `develop` keeps
   living and immediately continues collecting the next round of work.
4. Cut a version tag when the release warrants one (see
   [Versioning & releases](#versioning--releases)).

Never merge a feature branch straight into `master` - it only ever receives `develop` via a
release PR. If `master` ever moves independently (e.g. a hotfix), merge `master` back into
`develop` afterwards so the two branches do not diverge.

## Keeping docs and changelog in sync

- Code and the docs describing it change in the **same PR**.
- Add a bullet under `[Unreleased]` in `CHANGELOG.md` for anything user- or developer-visible.
- Significant technical decisions get an [ADR](https://adr.github.io/).

## Versioning & releases

- [Semantic Versioning](https://semver.org/). Pre-launch stays on `0.x`; first public
  production launch is `1.0.0`.
- To release:
  1. Move `[Unreleased]` to `## [x.y.z] - YYYY-MM-DD` in the changelog; start a fresh
     `[Unreleased]`.
  2. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"` and push tags.
  3. The deploy pipeline ships the tagged build.
- Bump rules: `feat` -> minor, `fix`/`perf` -> patch, `BREAKING CHANGE` -> major.

## Hygiene

- `.gitignore` excludes dependencies, build artifacts, env files (except an example), OS cruft.
  Each variant ships a starting `.gitignore`.
- Never commit secrets. If one leaks, rotate it and scrub history.
- No large binaries in git without reason; optimize assets before committing.
