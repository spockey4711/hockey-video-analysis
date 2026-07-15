# 0005 - Authenticate coaches with database-backed sessions

- **Status:** Proposed
- **Date:** 2026-07-15
- **Deciders:** Yannik
- **Supersedes:** none
- **Superseded by:** none

## Context

The app has two audiences with opposite access needs (PRD s2, s8): coaches create and edit
content and must be authenticated so their work carries an `author`, while players and the team
get read-only access through login-free secret links and must never see a login wall. Only coaches
authenticate. The team is small and self-hosted on a single always-on server (ADR 0003), so the
auth mechanism has to be simple to operate, leak no secrets into the client bundle, and meet the
security bar in `docs/flavors/auth.md` (memory-hard password hashing, rate limiting, HTTPS-only
cookies) without pulling in a heavy identity provider.

## Decision

We use server-rendered session-cookie auth backed by the `sessions` table (schema from P0-1), not
JWTs and not a third-party auth service.

- **Passwords** are hashed with Node's built-in memory-hard `scrypt` (`src/lib/auth/password.ts`).
  The cost parameters are stored inside each hash (`scrypt$N$r$p$salt$hash`) so they can be raised
  later without invalidating existing hashes. Node's standard library is preferred over adding a
  native `argon2`/`bcrypt` dependency; `scrypt` is OWASP-approved and avoids a build step. Verify
  is constant-time.
- **Sessions** are opaque random tokens (256-bit). Only the token's SHA-256 hash is stored as the
  session id, so a read-only leak of `sessions` yields no usable tokens. The raw token lives in an
  `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie. Sessions have a fixed 30-day lifetime
  (no sliding renewal), so validation never needs to write a cookie mid-render and is safe to call
  from a Server Component.
- **Authorization** is enforced in two layers: `src/middleware.ts` does a coarse cookie-presence
  redirect at the edge (it cannot reach Postgres), and `requireCoach()` in
  `src/features/access/` is the authoritative check that validates the session against the database
  before a page renders or an action mutates. `getCurrentCoach()` (React-`cache`d) is the shared
  "who is signed in" read that later tasks use to stamp `author`.
- **Account creation** is invite-gated self-registration: `/signup` works only when
  `AUTH_INVITE_CODE` is set and the coach supplies the matching code (constant-time compare). With
  the variable unset, signup is disabled - the secure default for a self-hosted deployment where we
  do not want any visitor to gain edit access.

Alternatives rejected: JWTs (revocation and rotation are awkward, and we already have a database
for opaque sessions), a hosted identity provider (overkill and another dependency for one team),
and open signup (any visitor could grant themselves coach access).

## Consequences

- Logout and session revocation are immediate (delete the row); no token blocklist is needed.
- The rate limiter is in-process (`src/features/access/rate-limit.ts`), which is correct for the
  single-node target but would need a shared store (e.g. Redis) if the app is ever scaled to
  multiple instances. This is called out at the module.
- Middleware only checks cookie presence, so it is defense-in-depth and UX, not the security
  boundary; every protected surface must still call `requireCoach()`. Skipping that check is the
  failure mode to watch for in review.
- Expired sessions are pruned opportunistically on access and via `deleteExpiredSessions()`; a
  periodic cleanup job can call the latter but is not required for correctness.
- Raising password cost later is a config change in `password.ts`; existing hashes keep verifying
  because their parameters travel with them.
