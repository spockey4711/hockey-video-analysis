# Architecture Decision Records

This directory holds the project's Architecture Decision Records (ADRs): short documents that
capture a significant architectural choice, the context that forced it, and the consequences we
accepted. Together they are the project's decision log - the "why" that code and commits do not
explain on their own.

Related: [engineering standards](../engineering/engineering-standards.md) ·
[conventions](../engineering/conventions.md)

## When to write one

Write an ADR when a decision is architecturally significant and expensive to reverse: something a
future maintainer would otherwise have to reverse-engineer or re-litigate. Typical triggers:

- A structural choice - a boundary, layering, data model or public interface.
- Adopting, replacing or dropping a notable dependency, framework or platform.
- A cross-cutting convention (error handling, auth, config, build) that the whole codebase follows.
- Anything you would want an explanation for if you found it in six months.

Skip the ADR for reversible, local or obvious choices - a variable name or a one-off helper does
not earn a record.

## How the flow works

1. **Copy the template.** Duplicate [`NNNN-template.md`](NNNN-template.md) to
   `NNNN-short-title.md`, where `NNNN` is the next zero-padded number in sequence (the last ADR
   here plus one) and the title is a few kebab-case words, e.g. `0005-use-signed-share-tokens.md`.
2. **Fill it in.** Keep it short - context, the decision, the consequences. State the decision in
   the present tense as a standing instruction ("We use X"), not a narrative.
3. **Open it as `Proposed`.** Raise the ADR in the same PR as the change it justifies, per the
   "docs change in the same PR as the code" rule. Discussion happens on the PR.
4. **Mark it `Accepted`** when the PR merges. An ADR is immutable once accepted: do not rewrite
   history.
5. **Supersede, never delete.** When a later decision overrides an earlier one, write a new ADR,
   set the old one's status to `Superseded by NNNN`, and link the two. The record of what we once
   believed is part of the value.

## Statuses

- **Proposed** - under discussion, not yet in effect.
- **Accepted** - the decision is in force.
- **Deprecated** - no longer recommended, but not yet replaced.
- **Superseded by NNNN** - replaced by a later ADR; follow the link.

## Index

- [0001 - Record architecture decisions](0001-record-architecture-decisions.md)
- [0002 - Global game-time offset as the single time coordinate](0002-global-game-time-offset-model.md)
- [0003 - Split work across M4, VPS and NAS by cost profile](0003-hardware-role-split.md)
- [0004 - Cut clips with `-c copy`, accepting keyframe tolerance](0004-copy-cut-clips-with-keyframe-tolerance.md)
- [0005 - Authenticate coaches with database-backed sessions](0005-coach-auth-database-sessions.md)
- [0006 - Serve a downscaled proxy rendition to the tagging player](0006-proxy-rendition-for-in-browser-tagging.md)

Keep this index in sync when you add an ADR.
