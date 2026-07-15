# Flavor: Authentication scaffolding

Layered on with `--flavor auth`. Auth is deeply stack-specific, so this add-on is
documentation-first: it records the conventions and the security bar to hold, and
adds ignore rules so keys and secrets never get committed.

## What landed

- `.gitignore` rules for private keys and local secret files (`*.pem`, `*.key`,
  `.env.local`, `secrets/`).

## Decide the model

- Session cookies (server-rendered apps): store a session id in an `HttpOnly`,
  `Secure`, `SameSite` cookie; keep session state server-side.
- Bearer tokens / JWT (APIs and SPAs): short-lived access token plus a rotating
  refresh token; validate signature and expiry on every request.

Pick one deliberately and keep it consistent across the app.

## Secrets

- Read every secret (signing key, OAuth client secret, session key) from the
  environment. Never commit one; `.env.local` and key files are git-ignored by this
  flavor.
- Rotate keys on a schedule and support two valid keys during a rotation window.

```
# .env.local (git-ignored) - example
AUTH_SECRET=change-me-to-a-long-random-value
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=
```

## Passwords and the security bar

- Hash passwords with a memory-hard algorithm (argon2id or bcrypt); never store or
  log them in plaintext.
- Enforce rate limiting and lockout on login and token endpoints.
- Send auth cookies and tokens only over HTTPS.
- Validate and scope every token; check authorization (what the user may do) on
  each request, not just authentication (who they are).
- Follow the OWASP Authentication and Session Management cheat sheets.

## Wire it in

Use your stack's established library rather than rolling your own crypto - for
example Passport/Auth.js (Node), Authlib/FastAPI security (Python), Spring Security
(Java), or the platform's first-party auth SDK. Put user-facing auth copy in the
localization layer, not inline strings.
