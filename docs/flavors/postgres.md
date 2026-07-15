# Flavor: Database (PostgreSQL)

Layered on with `--flavor postgres`. Brings a local PostgreSQL service and the
conventions for connecting to it, migrating it, and keeping its credentials out of
the repo.

## What landed

- `docker-compose.yml` - a `db` service running `postgres:16` with a persistent
  named volume and a health check. Local development only.

## Run it

```bash
docker compose up -d db      # start Postgres in the background
docker compose logs -f db    # tail logs
docker compose down          # stop (data survives in the pgdata volume)
```

## Connect

Point your app at the database through a single `DATABASE_URL`, read from the
environment - never commit it. Add to your `.env` (and document it in
`.env.example`):

```
DATABASE_URL=postgresql://app:app@localhost:5432/app
```

Override `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` in the environment to
change the credentials the compose service creates.

## Migrations

Manage the schema with your stack's migration tool (Alembic, Flyway, golang-migrate,
Prisma, ...). Keep migrations in version control, one change per file, applied in CI
against a throwaway database so a bad migration fails the build.

## Security

- The compose credentials are development defaults. In shared or production
  environments, supply them from a secrets manager and never reuse the local
  password.
- Grant the application role only the privileges it needs; do not connect as a
  superuser from the app.
- Keep the database off the public internet; expose it only to the app network.
