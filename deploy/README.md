# Deploy configs

Optional, per-platform infrastructure config to go with the deployment runbook in
[`../docs/ops/deployment.md`](../docs/ops/deployment.md). These are skeletons: pick
the one target you are deploying to, fill in the `<...>` placeholders, and delete
the rest - three half-configured platforms help no one. If you ran the setup
interview, the deploy-target answer already tells you which to keep.

| Path | Target | Use when |
|------|--------|----------|
| [`vercel.json`](vercel.json) | Vercel | The primary managed target for Next.js - `vercel deploy` or a connected repo. |
| [`../Dockerfile`](../Dockerfile), [`../docker-compose.yml`](../docker-compose.yml) | Any container runtime | You self-host the standalone image (VPS, Kubernetes, Fly, Render, ...). |
| [`fly.toml`](fly.toml) | Fly.io | `fly deploy` from the repo. |
| [`render.yaml`](render.yaml) | Render | Render Blueprint, provisioned from the repo. |
| [`terraform/`](terraform/) | Any (IaC) | You provision infrastructure declaratively. |

**Vercel needs no Dockerfile.** It builds and hosts Next.js natively from the repo -
`vercel.json` just pins the framework and the install/build commands. The
[`../Dockerfile`](../Dockerfile) is for self-hosting the standalone output on a
container runtime (Fly, Render, a VPS, Kubernetes); ignore it if you deploy to Vercel.

Rules that apply to every target:

- **Secrets never live in these files.** Set them in the platform's secret store
  (the Vercel/Render dashboards, `fly secrets set`, Terraform variables sourced
  from a secrets manager) and keep `.env*` out of the repo and out of the image (see
  [`../.dockerignore`](../.dockerignore)).
- **`NEXT_PUBLIC_*` is a build-time value** inlined into the client bundle, so it
  must be present when the platform builds - set it as a build-time env var (never a
  server-only secret) and rebuild after changing it.
- **The container image is built from the repo's `Dockerfile`** (Next.js standalone
  output on a slim non-root runtime). Tag it with the commit SHA, never `latest`, so a
  rollback is just a redeploy of a known-good tag.
- **`.env.example` / `.env.schema` are the single source of truth** for which
  variables every target must supply. The quality gate fails if they drift apart, so
  the platform config above and the app stay in agreement on what the environment
  needs.
