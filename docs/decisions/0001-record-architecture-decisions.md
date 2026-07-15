# 0001 - Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** project maintainers
- **Supersedes:** none
- **Superseded by:** none

## Context

Architecturally significant decisions - boundaries, data models, dependencies, cross-cutting
conventions - shape a codebase long after they are made, but the reasoning behind them is easily
lost. Code shows *what* the system does; commit messages capture *what changed*; neither reliably
records *why* a path was chosen over the alternatives. Without a durable record, that context lives
only in the heads of whoever was present, and new contributors (human or AI) either re-litigate
settled questions or unknowingly undo decisions whose rationale they never saw.

## Decision

We record architecturally significant decisions as Architecture Decision Records (ADRs), following
the lightweight format popularized by Michael Nygard.

- Each ADR is one Markdown file in `docs/decisions/`, numbered sequentially and zero-padded
  (`0001`, `0002`, ...), with a short kebab-case title: `NNNN-short-title.md`.
- New ADRs start from [`NNNN-template.md`](NNNN-template.md) and carry a status of `Proposed`,
  `Accepted`, `Deprecated` or `Superseded by NNNN`.
- An ADR is raised in the same PR as the change it justifies and marked `Accepted` when that PR
  merges. Accepted ADRs are immutable; a reversal is a new ADR that supersedes the old one rather
  than an edit.
- The [`docs/decisions/README.md`](README.md) index explains the flow and lists every ADR.

## Consequences

- The "why" behind significant choices is captured where the next maintainer will look for it,
  and stays reviewable through the normal PR process.
- Writing an ADR is a small, deliberate cost at decision time - the discipline is worthwhile only
  if we reserve ADRs for decisions that are significant and expensive to reverse, not routine ones.
- The decision log is append-only: superseded ADRs remain in place as a history of what the project
  once believed and why it changed, rather than being deleted.
- This ADR is itself the first record and the working example of the format.
