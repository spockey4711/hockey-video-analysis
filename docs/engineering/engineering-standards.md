# Engineering standards

**Purpose:** the mindset behind the concrete rules. Treat every project built from this
blueprint like production code at a serious software company, not a hobby project. The bar is
professional even when the repo is a single developer run with the discipline of a team.

Related: [conventions](conventions.md) · [quality & testing](quality-and-testing.md) ·
[git workflow](git-workflow.md)

## How to work

- Read before you write. Understand the existing code, docs and conventions first, then match
  the surrounding style instead of importing your own.
- Small, reversible steps. One logical change per commit/PR; keep the tree green at every step.
- Leave code better than you found it (Boy Scout Rule) - but do not smuggle unrelated refactors
  into a change. Separate concerns into separate commits/PRs.
- Make it work, then make it right, then make it fast - in that order. No premature
  optimization; measure before optimizing.
- Prefer boring, obvious solutions over clever ones. Code is read far more often than written;
  optimize for the next reader.

## Design principles

- SOLID, DRY, KISS, YAGNI. One responsibility per unit; do not abstract until you have two or
  three real cases - avoid speculative generality.
- Composition over inheritance. Prefer pure functions; push side effects to the edges and keep
  the core testable.
- Explicit over implicit: descriptive names, typed boundaries, no hidden global state.
- Encapsulate what changes; keep public surfaces small and stable. Program to interfaces, not
  implementations.

## Correctness & quality

- Types are the cheapest documentation and the cheapest bug prevention - strict everywhere, no
  escape hatches without a justified comment.
- Tests are part of the change, not a follow-up. Test what has logic or can silently break.
- Zero warnings in CI. Formatting and lint are settled by tooling, not by opinion.
- Handle errors deliberately: fail loudly in development, degrade gracefully in production.
- Every behavioral change ships with its docs and a `CHANGELOG.md` entry in the same PR.

## Security & data

- Never trust input; validate and sanitize at boundaries. OWASP Top 10 mindset even for a
  small app.
- Never leak secrets into a client bundle or public config. Least privilege for tokens and env
  vars; rotate immediately on any leak.

## Reviews & collaboration

- Every change goes through a PR, even solo - self-review the full diff before pushing and read
  it as if someone else wrote it.
- Conventional Commits with a clear "what and why". Commit messages and PR descriptions are
  written for the future maintainer, who is usually you in six months.

## Conventions over configuration

- No emojis anywhere in the repo. Use the regular hyphen `-` only (no fancy dashes).
- English in code, comments, docs, commits and PRs. Localize user-facing copy in a dedicated
  layer, never as scattered string literals.

## External references worth internalizing

- Google Engineering Practices (code review + authoring) - https://google.github.io/eng-practices/
- The Twelve-Factor App (config, deploy hygiene) - https://12factor.net/
- Conventional Commits - https://www.conventionalcommits.org/
- Keep a Changelog - https://keepachangelog.com/
- Semantic Versioning - https://semver.org/
- OWASP Top 10 (web security baseline) - https://owasp.org/www-project-top-ten/
- Refactoring / code smells (Martin Fowler) - https://refactoring.com/
